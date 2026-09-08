
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>

// CẤU HÌNH SƠ ĐỒ CHÂN (MATCHING USER HARDWARE)
#define PIN_I2C_SDA         21  
#define PIN_I2C_SCL         22  

#define PIN_DHT_INDOOR      27  
#define PIN_DHT_OUTDOOR     14  

#define PIN_PIR             34  

#define PIN_MOSFET_FAN      25  
#define PIN_MOSFET_LED_IN   26  
#define PIN_MOSFET_LED_DESK 32  
#define PIN_MOSFET_LED_OUT  33  

#define DHTTYPE             DHT22

// Khởi tạo các cảm biến
DHT dhtIndoor(PIN_DHT_INDOOR, DHTTYPE);
DHT dhtOutdoor(PIN_DHT_OUTDOOR, DHTTYPE);

BH1750 bh1750Indoor;   
BH1750 bh1750Outdoor;  


// CÁC THAM SỐ THUẬT TOÁN & NGƯỠNG THIẾT LẬP
// 1. Hệ số lọc Exponential Moving Average (EMA) (0.0 < ALPHA <= 1.0)
// Giá trị càng nhỏ thì bộ lọc càng mịn và mượt, triệt tiêu tối đa xung nhiễu
const float EMA_ALPHA = 0.15;

// 2. Ngưỡng Hysteresis cho LED ngoài sân (BH1750 ngoài trời)
const float LUX_OUTDOOR_LOW  = 10.0;  
const float LUX_OUTDOOR_HIGH = 15.0;  

// 3. Ngưỡng ánh sáng trong nhà
const float LUX_INDOOR_TARGET = 100.0; 

// 4. Thời gian giữ sáng (Hold-time) của LED trong nhà và LED bàn học (ms)
const unsigned long LED_HOLD_TIME = 10000; 

// 5. Cấu hình bảo vệ động cơ Quạt (Minimum Switching Time)
const unsigned long FAN_MIN_RUN_TIME  = 15000; 
const unsigned long FAN_MIN_OFF_TIME  = 15000; 

// 6. Ngưỡng Hysteresis nhiệt độ cho Quạt thông gió (ASHRAE 55)
const float TEMP_MIN_COMFORT    = 27.0; 
const float TEMP_DIFF_ACTIVATE  = 1.0;  
const float TEMP_DIFF_DEACTIVATE= 0.5;  

// 7. Cấu hình bộ lọc Debounce chống nhiễu PIR
const unsigned long PIR_DEBOUNCE_TIME = 300; 

// Cấu hình PWM cho LED trong nhà (Đã tương thích ESP32 Arduino Core v3.x)
#define LEDC_TIMER_12_BIT    12
#define LEDC_BASE_FREQ       5000


// ĐỊNH NGHĨA CÁC TRẠNG THÁI MÁY (STATE MACHINES)
enum FanState {
  FAN_STATE_OFF,
  FAN_STATE_ON,
  FAN_STATE_COOLDOWN // Trạng thái bảo vệ
};

enum LedIndoorState {
  LED_IN_STATE_OFF,
  LED_IN_STATE_FADING_IN,
  LED_IN_STATE_STABLE,
  LED_IN_STATE_FADING_OUT
};

enum PirFilteredState {
  PIR_UNCONFIRMED_LOW,
  PIR_DEBOUNCING_HIGH,
  PIR_CONFIRMED_HIGH,
  PIR_DEBOUNCING_LOW
};

// CÁC BIẾN TOÀN CỤC LƯU TRẠNG THÁI
// Biến lưu trữ sau khi lọc EMA
float filteredLuxIndoor = 100.0;
float filteredLuxOutdoor = 100.0;

// Các biến trạng thái máy
FanState currentFanState = FAN_STATE_OFF;
LedIndoorState currentLedInState = LED_IN_STATE_OFF;
PirFilteredState currentPirState = PIR_UNCONFIRMED_LOW;

// Biến quản lý thời gian
unsigned long lastFanStateChangeTime = 0;
unsigned long lastPIRActivityTime = 0;
unsigned long pirStateChangeTimer = 0;
unsigned long lastTelemetryTime = 0;

// Biến điều khiển LED bàn học
bool deskLedState = false;

// Lưu trữ trạng thái chân vật lý của PIR
bool lastPhysicalPirState = LOW;

// Khai báo prototype cho các hàm xử lý
void processPIRAntiChattering(unsigned long now);
void processFanStateMachine(unsigned long now);
void processIndoorLightingStateMachine(unsigned long now);
void processOutdoorLighting(unsigned long now);
void printSystemTelemetry();

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  Serial.println(F("\n========================================================"));
  Serial.println(F("   KHOI DONG HE THONG SMART HOME V3 (ALGORITHMS-BASED)  "));
  Serial.println(F("========================================================"));

  // 1. Khởi tạo cấu hình chân I/O vật lý
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_MOSFET_FAN, OUTPUT);
  pinMode(PIN_MOSFET_LED_DESK, OUTPUT);
  pinMode(PIN_MOSFET_LED_OUT, OUTPUT);

  // Mặc định tắt các tải khi khởi động mạch
  digitalWrite(PIN_MOSFET_FAN, LOW);
  digitalWrite(PIN_MOSFET_LED_DESK, LOW);
  digitalWrite(PIN_MOSFET_LED_OUT, LOW);

  // 2. Khởi tạo xung PWM chuyên dụng cho LED trong nhà
  ledcAttach(PIN_MOSFET_LED_IN, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcWrite(PIN_MOSFET_LED_IN, 0);

  // 3. Khởi tạo đường I2C chung (PHẢI CHẠY TRƯỚC KHI ĐỌC CẢM BIẾN)
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  // Khởi tạo cảm biến BH1750 Trong nhà (ADDR = GND -> 0x23)
  if (bh1750Indoor.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire)) {
    Serial.println(F("[OK] Khoi tao BH1750 Trong nha (0x23) thanh cong."));
  } else {
    Serial.println(F("[ERR] Loi khoi tao BH1750 Trong nha! Vui long kiem tra day."));
  }

  // Khởi tạo cảm biến BH1750 Ngoài sân (ADDR = 3.3V -> 0x5C)
  if (bh1750Outdoor.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C, &Wire)) {
    Serial.println(F("[OK] Khoi tao BH1750 Ngoai san (0x5C) thanh cong."));
  } else {
    Serial.println(F("[ERR] Loi khoi tao BH1750 Ngoai san! Vui long kiem tra day."));
  }

  // Khởi tạo cảm biến DHT22
  dhtIndoor.begin();
  dhtOutdoor.begin();
  Serial.println(F("[OK] Khoi tao 2 cam bien DHT22 thanh cong."));

  // 4. Đọc giá trị mốc ban đầu (Sau khi đã khởi tạo hoàn tất)
  float initIn = bh1750Indoor.readLightLevel();
  float initOut = bh1750Outdoor.readLightLevel();
  
  filteredLuxIndoor = (initIn >= 0) ? initIn : 100.0;
  filteredLuxOutdoor = (initOut >= 0) ? initOut : 100.0;

  Serial.println(F("========================================================\n"));
}
void loop() {
  unsigned long currentTime = millis();

  // 1. Đọc dữ liệu thô và áp dụng bộ lọc EMA (Exponential Moving Average Filter)
  // Thực hiện lấy mẫu cảm biến không đồng bộ (non-blocking) mỗi 200ms
  static unsigned long lastSensorSample = 0;
  if (currentTime - lastSensorSample >= 200) {
    lastSensorSample = currentTime;

    // Đọc ánh sáng thô và làm mịn qua bộ lọc thông thấp số học
    float rawLuxIn = bh1750Indoor.readLightLevel();
    float rawLuxOut = bh1750Outdoor.readLightLevel();

    if (rawLuxIn >= 0) {
      filteredLuxIndoor = (EMA_ALPHA * rawLuxIn) + ((1.0 - EMA_ALPHA) * filteredLuxIndoor);
    }
    if (rawLuxOut >= 0) {
      filteredLuxOutdoor = (EMA_ALPHA * rawLuxOut) + ((1.0 - EMA_ALPHA) * filteredLuxOutdoor);
    }
  }

  // 2. Chạy thuật toán lọc chống rung (Anti-chattering) cho cảm biến hồng ngoại PIR
  processPIRAntiChattering(currentTime);

  // 3. Máy trạng thái điều khiển hệ thống Quạt (State Machine + Min Switching Time + Hysteresis)
  processFanStateMachine(currentTime);

  // 4. Máy trạng thái điều khiển LED trong nhà & LED Bàn học tự động
  processIndoorLightingStateMachine(currentTime);

  // 5. Điều khiển LED ngoài vườn bằng thuật toán trễ biên (Hysteresis) 
  processOutdoorLighting(currentTime);

  // 6. Truyền số liệu giám sát hệ thống lên Serial Monitor định kỳ 1.5 giây
  if (currentTime - lastTelemetryTime >= 1500) {
    lastTelemetryTime = currentTime;
    printSystemTelemetry();
  }
}

// HÀM XỬ LÝ CHỐNG RUNG (ANTI-CHATTERING) CHO CẢM BIẾN PIR HC-SR501
void processPIRAntiChattering(unsigned long now) {
  bool physicalState = digitalRead(PIN_PIR);

  switch (currentPirState) {
    case PIR_UNCONFIRMED_LOW:
      if (physicalState == HIGH) {
        currentPirState = PIR_DEBOUNCING_HIGH;
        pirStateChangeTimer = now;
      }
      break;

    case PIR_DEBOUNCING_HIGH:
      if (physicalState == HIGH) {
        if (now - pirStateChangeTimer >= PIR_DEBOUNCE_TIME) {
          currentPirState = PIR_CONFIRMED_HIGH;
          lastPIRActivityTime = now; // Cập nhật mốc thời gian có người
        }
      } else {
        // Trạng thái không ổn định, quay về LOW
        currentPirState = PIR_UNCONFIRMED_LOW;
      }
      break;

    case PIR_CONFIRMED_HIGH:
      lastPIRActivityTime = now; // Liên tục cập nhật khi có người chuyển động
      if (physicalState == LOW) {
        currentPirState = PIR_DEBOUNCING_LOW;
        pirStateChangeTimer = now;
      }
      break;

    case PIR_DEBOUNCING_LOW:
      if (physicalState == LOW) {
        if (now - pirStateChangeTimer >= PIR_DEBOUNCE_TIME) {
          currentPirState = PIR_UNCONFIRMED_LOW;
        }
      } else {
        // Có chuyển động lại ngay lập tức, giữ mức HIGH 
        currentPirState = PIR_CONFIRMED_HIGH;
      }
      break;
  }
}

// FSM ĐIỀU KHIỂN QUẠT THÔNG GIÓ (MINIMUM SWITCHING TIME + HYSTERESIS)
void processFanStateMachine(unsigned long now) {
  float tempIn = dhtIndoor.readTemperature();
  float tempOut = dhtOutdoor.readTemperature();

  if (isnan(tempIn) || isnan(tempOut)) return;

  switch (currentFanState) {
    case FAN_STATE_OFF:
      if (tempIn > TEMP_MIN_COMFORT && (tempIn - tempOut) > TEMP_DIFF_ACTIVATE) {
        currentFanState = FAN_STATE_ON;
        digitalWrite(PIN_MOSFET_FAN, HIGH);
        lastFanStateChangeTime = now; 
      }
      break;

    case FAN_STATE_ON:
      if (now - lastFanStateChangeTime >= FAN_MIN_RUN_TIME) {
        if (tempIn <= (TEMP_MIN_COMFORT - 0.5) || (tempIn - tempOut) <= TEMP_DIFF_DEACTIVATE) {
          currentFanState = FAN_STATE_COOLDOWN;
          digitalWrite(PIN_MOSFET_FAN, LOW);
          lastFanStateChangeTime = now; 
        }
      }
      break;

    case FAN_STATE_COOLDOWN:
      if (now - lastFanStateChangeTime >= FAN_MIN_OFF_TIME) {
        currentFanState = FAN_STATE_OFF; 
      }
      break;
  }
}

// FSM ĐIỀU KHIỂN ĐÈN TRONG NHÀ & LED BÀN HỌC TỰ ĐỘNG
void processIndoorLightingStateMachine(unsigned long now) {
  bool hasUser = (currentPirState == PIR_CONFIRMED_HIGH || (now - lastPIRActivityTime < LED_HOLD_TIME));
  int targetPwm = 0;

  switch (currentLedInState) {
    case LED_IN_STATE_OFF:
      if (hasUser && filteredLuxIndoor < LUX_INDOOR_TARGET) {
        currentLedInState = LED_IN_STATE_FADING_IN;
      }
      break;

    case LED_IN_STATE_FADING_IN:
    case LED_IN_STATE_STABLE:
      if (!hasUser) {
        currentLedInState = LED_IN_STATE_FADING_OUT;
      } else if (filteredLuxIndoor >= LUX_INDOOR_TARGET) {
        currentLedInState = LED_IN_STATE_FADING_OUT;
      } else {
        float deficit = LUX_INDOOR_TARGET - filteredLuxIndoor;
        float outputRatio = deficit / LUX_INDOOR_TARGET; // Tỷ lệ từ 0.0 -> 1.0
        targetPwm = (int)(outputRatio * 4095); // Thang đo xung PWM 12-bit
        targetPwm = constrain(targetPwm, 0, 4095);

        currentLedInState = LED_IN_STATE_STABLE;
      }
      break;

    case LED_IN_STATE_FADING_OUT:
      if (hasUser && filteredLuxIndoor < LUX_INDOOR_TARGET) {
        currentLedInState = LED_IN_STATE_FADING_IN;
      } else {
        targetPwm = 0;
        currentLedInState = LED_IN_STATE_OFF;
      }
      break;
  }

  ledcWrite(PIN_MOSFET_LED_IN, targetPwm);

  deskLedState = hasUser;
  digitalWrite(PIN_MOSFET_LED_DESK, deskLedState ? HIGH : LOW);
}

// THUẬT TOÁN TRỄ BIÊN (HYSTERESIS) CHO ĐÈN NGOÀI SÂN VƯỜN
void processOutdoorLighting(unsigned long now) {
  static bool outdoorLightOn = false;
  if (filteredLuxOutdoor < LUX_OUTDOOR_LOW) {
    outdoorLightOn = true; 
  } else if (filteredLuxOutdoor > LUX_OUTDOOR_HIGH) {
    outdoorLightOn = false; 
  }

  digitalWrite(PIN_MOSFET_LED_OUT, outdoorLightOn ? HIGH : LOW);
}

// IN DỮ LIỆU TELEMETRY LÊN SERIAL MONITOR ĐỂ KIỂM TRA & BÁO CÁO 
void printSystemTelemetry() {
  float tIn = dhtIndoor.readTemperature();
  float tOut = dhtOutdoor.readTemperature();

  Serial.println(F("================ telemetry data ================"));
  Serial.printf("Lux Trong Nha (Raw -> EMA): %6.1f lx | Lux Ngoai San (Raw -> EMA): %6.1f lx\n",
                bh1750Indoor.readLightLevel(), filteredLuxIndoor,
                bh1750Outdoor.readLightLevel(), filteredLuxOutdoor);

  Serial.printf("Nhiet do Indoor: %5.1f*C | Nhiet do Outdoor: %5.1f*C | Chenh lech: %4.1f*C\n",
                tIn, tOut, (tIn - tOut));

  const char* fanStateStr = (currentFanState == FAN_STATE_OFF) ? "OFF" :
                            (currentFanState == FAN_STATE_ON)  ? "RUNNING (ON)" : "COOLDOWN (LOCK)";

  const char* pirStateStr = (currentPirState == PIR_CONFIRMED_HIGH) ? "CÓ NGƯỜI (CONFIRMED)" :
                            (currentPirState == PIR_DEBOUNCING_HIGH) ? "ĐANG LỌC BẬT (DEBOUNCE)" :
                            (currentPirState == PIR_DEBOUNCING_LOW)  ? "ĐANG LỌC TẮT (DEBOUNCE)" : "TRỐNG KHÔNG";

  const char* ledInStr    = (currentLedInState == LED_IN_STATE_OFF) ? "OFF" :
                            (currentLedInState == LED_IN_STATE_FADING_IN) ? "FADING IN" :
                            (currentLedInState == LED_IN_STATE_STABLE) ? "ACTIVE (STABLE)" : "FADING OUT";

  Serial.printf("FSM-PIR: %-25s | FSM-Quat: %-18s\n", pirStateStr, fanStateStr);
  Serial.printf("FSM-LED-Trong: %-20s | LED-Ban-Hoc: %-5s | LED-Ngoai-San: %-5s\n",
                ledInStr, deskLedState ? "ON" : "OFF",
                digitalRead(PIN_MOSFET_LED_OUT) ? "ON" : "OFF");
  Serial.println(F("================================================\n"));
}
