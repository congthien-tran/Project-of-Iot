#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <esp_arduino_version.h>
#include <deque>

// ==================== CẤU HÌNH MẠNG & MQTT BROKER ====================
const char* WIFI_SSID     = "Tharo";
const char* WIFI_PASS     = "Tharooooooo";

const char* MQTT_BROKER   = "5b48de2a237d43edbd050421370acd77.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "DuonglendinhOlympia";
const char* MQTT_PASS     = "12345678";

const char* TOPIC_TELEMETRY = "hcmute/iot/climate/telemetry";
const char* TOPIC_STATUS    = "hcmute/iot/climate/status";
const char* TOPIC_CONTROL   = "hcmute/iot/climate/control";

// ==================== HÀNG ĐỢI BỘ ĐỆM 10 PHẦN TỬ (BUFFER) ====================
std::deque<String> telemetryQueue;
const size_t MAX_QUEUE_SIZE = 10;

// ==================== CẤU HÌNH SƠ ĐỒ CHÂN PHẦN CỨNG ====================
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

// Cảm biến & Client
DHT dhtIndoor(PIN_DHT_INDOOR, DHTTYPE);
DHT dhtOutdoor(PIN_DHT_OUTDOOR, DHTTYPE);
BH1750 bh1750Indoor;
BH1750 bh1750Outdoor;

WiFiClientSecure espClientSecure;
PubSubClient client(espClientSecure);

// Mutex bảo vệ dữ liệu chia sẻ giữa Core 0 và Core 1
SemaphoreHandle_t xDataMutex = NULL;

// ==================== HARDWARE TIMER & BIẾN ĐỆM DHT ====================
hw_timer_t *timerDHT = NULL;
volatile bool dhtReadFlag = false;

float cachedTempIndoor  = 28.0;
float cachedHumiIndoor  = 65.0;
float cachedTempOutdoor = 29.0;
float cachedHumiOutdoor = 68.0;

void IRAM_ATTR onDhtTimer() {
  dhtReadFlag = true;
}

// ==================== THAM SỐ THUẬT TOÁN & NGƯỠNG ====================
const float EMA_ALPHA           = 0.15;
const float LUX_OUTDOOR_LOW     = 10.0;
const float LUX_OUTDOOR_HIGH    = 15.0;
const float LUX_INDOOR_TARGET   = 100.0;
const unsigned long LED_ROOM_HOLD_TIME = 3000;
const unsigned long LED_DESK_HOLD_TIME = 30000;

const unsigned long FAN_MIN_RUN_TIME   = 15000;
const unsigned long FAN_MIN_OFF_TIME   = 15000;

// Tham số Kickstart quạt
const unsigned long FAN_KICKSTART_DURATION = 400; // 400ms đề-pa
const int FAN_KICKSTART_PWM               = 4095;

// Tham số Burst-Mode
const int FAN_SUSTAIN_PWM        = 1700;
const int FAN_COAST_PWM          = 900;
const unsigned long FAN_BURST_PERIOD_MS = 250;
const float FAN_BURST_MIN_RATIO  = 0.15;

const float TEMP_MIN_COMFORT    = 27.0;
const float TEMP_DIFF_ACTIVATE  = 1.0;
const float TEMP_DIFF_DEACTIVATE= 0.5;

const float HUMI_MAX_COMFORT    = 70.0;
const float HUMI_DIFF_ACTIVATE  = 5.0;
const float HUMI_DIFF_DEACTIVATE= 2.0;

const unsigned long PIR_DEBOUNCE_TIME  = 200;

#define LEDC_TIMER_12_BIT    12
#define LEDC_BASE_FREQ       5000

// ==================== STATE MACHINE & BIẾN TOÀN CỤC ====================
enum FanState { FAN_STATE_OFF, FAN_STATE_ON, FAN_STATE_COOLDOWN };
enum PirFilteredState { PIR_UNCONFIRMED_LOW, PIR_DEBOUNCING_HIGH, PIR_CONFIRMED_HIGH, PIR_DEBOUNCING_LOW };

float filteredLuxIndoor  = 100.0;
float filteredLuxOutdoor = 100.0;

FanState currentFanState         = FAN_STATE_OFF;
PirFilteredState currentPirState = PIR_UNCONFIRMED_LOW;

unsigned long lastFanStateChangeTime = 0;
unsigned long lastPIRActivityTime    = 0;
unsigned long pirStateChangeTimer    = 0;
unsigned long lastTelemetryTime      = 0;
unsigned long lastMqttRetryTime      = 0;

// Biến điều khiển PWM
int currentIndoorPwm = 0;
int targetFanPwm     = 0;
int currentFanPwm    = 0;
bool isFanKickstarting = false;
unsigned long fanKickStartTime = 0;

bool fanBurstModeActive = false;
unsigned long fanBurstCycleStart = 0;

bool deskLedState    = false;
String currentMode   = "AUTO";

// Prototypes
void processPIRAntiChattering(unsigned long now);
void processFanStateMachine(unsigned long now);
void processFanSpeedRamp(unsigned long now);
void triggerFanKickstart(int newTargetPwm, unsigned long now);
void processIndoorLightingStateMachine(unsigned long now);
void processOutdoorLighting(unsigned long now);
void updateDHTData();
void printSystemTelemetry();
void setupWiFi();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishTelemetry();

// Task Handles
TaskHandle_t TaskNetworkHandle = NULL;
TaskHandle_t TaskControlHandle = NULL;

// ==================== TASK 1: NETWORK & MQTT (CHẠY TRÊN CORE 0) ====================
void TaskNetwork(void *pvParameters) {
  setupWiFi();
  espClientSecure.setInsecure();
  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setCallback(mqttCallback);
  client.setBufferSize(1024);

  for (;;) {
    unsigned long currentTime = millis();

    // 1. Duy trì kết nối MQTT
    if (!client.connected()) {
      if (currentTime - lastMqttRetryTime > 5000) {
        lastMqttRetryTime = currentTime;
        reconnectMQTT();
      }
    } else {
      client.loop();
    }

    // 2. Gửi Telemetry định kỳ mỗi 3 giây
    if (currentTime - lastTelemetryTime >= 3000) {
      lastTelemetryTime = currentTime;
      if (xSemaphoreTake(xDataMutex, portMAX_DELAY) == pdTRUE) {
        printSystemTelemetry();
        publishTelemetry();
        xSemaphoreGive(xDataMutex);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10)); // Nhường CPU cho hệ thống
  }
}

// ==================== TASK 2: HARDWARE & CONTROL (CHẠY TRÊN CORE 1) ====================
void TaskControl(void *pvParameters) {
  static unsigned long lastSensorSample = 0;

  for (;;) {
    unsigned long currentTime = millis();

    if (xSemaphoreTake(xDataMutex, portMAX_DELAY) == pdTRUE) {
      // 1. Kiểm tra cờ ngắt từ Hardware Timer để cập nhật DHT22
      if (dhtReadFlag) {
        dhtReadFlag = false;
        updateDHTData();
      }

      // 2. Lọc EMA ánh sáng (Tối ưu chu kỳ đọc 200ms)
      if (currentTime - lastSensorSample >= 200) {
        lastSensorSample = currentTime;
        float rawLuxIn  = bh1750Indoor.readLightLevel();
        float rawLuxOut = bh1750Outdoor.readLightLevel();

        if (rawLuxIn >= 0) {
          filteredLuxIndoor = (EMA_ALPHA * rawLuxIn) + ((1.0 - EMA_ALPHA) * filteredLuxIndoor);
        }
        if (rawLuxOut >= 0) {
          filteredLuxOutdoor = (EMA_ALPHA * rawLuxOut) + ((1.0 - EMA_ALPHA) * filteredLuxOutdoor);
        }
      }

      // 3. Chống rung PIR FSM
      processPIRAntiChattering(currentTime);

      // 4. State Machine thiết bị trong AUTO Mode
      if (currentMode == "AUTO") {
        processFanStateMachine(currentTime);
        processIndoorLightingStateMachine(currentTime);
      }

      // 5. Điều khiển Kickstart / Burst-mode / Soft-ramp quạt
      processFanSpeedRamp(currentTime);

      // 6. Chiếu sáng sân vườn
      processOutdoorLighting(currentTime);

      xSemaphoreGive(xDataMutex);
    }

    vTaskDelay(pdMS_TO_TICKS(10)); // Chu kỳ 10ms (100Hz) đủ mượt cho Ramp PWM & Burst Mode
  }
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  Serial.println(F("\n========================================================"));
  Serial.println(F("   SMART HOME CLIMATE - FREERTOS DUAL-CORE OPTIMIZED   "));
  Serial.println(F("========================================================"));

  // Tạo Mutex khóa dữ liệu dùng chung
  xDataMutex = xSemaphoreCreateMutex();

  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_MOSFET_LED_DESK, OUTPUT);
  pinMode(PIN_MOSFET_LED_OUT, OUTPUT);

  digitalWrite(PIN_MOSFET_LED_DESK, LOW);
  digitalWrite(PIN_MOSFET_LED_OUT, LOW);

  // Khởi tạo PWM 12-bit
  ledcAttach(PIN_MOSFET_LED_IN, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcWrite(PIN_MOSFET_LED_IN, 0);

  ledcAttach(PIN_MOSFET_FAN, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcWrite(PIN_MOSFET_FAN, 0);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  if (bh1750Indoor.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire)) {
    Serial.println(F("[OK] BH1750 Trong nha (0x23) online."));
  } else {
    Serial.println(F("[ERR] Loi BH1750 Trong nha!"));
  }

  if (bh1750Outdoor.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C, &Wire)) {
    Serial.println(F("[OK] BH1750 Ngoai san (0x5C) online."));
  } else {
    Serial.println(F("[ERR] Loi BH1750 Ngoai san!"));
  }

  dhtIndoor.begin();
  dhtOutdoor.begin();
  Serial.println(F("[OK] 2x DHT22 online."));

  delay(1000);
  updateDHTData();

  float initIn = bh1750Indoor.readLightLevel();
  float initOut = bh1750Outdoor.readLightLevel();
  filteredLuxIndoor  = (initIn >= 0) ? initIn : 100.0;
  filteredLuxOutdoor = (initOut >= 0) ? initOut : 100.0;

  // Cấu hình Hardware Timer 2.5s đọc DHT
#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  timerDHT = timerBegin(1000000);
  timerAttachInterrupt(timerDHT, &onDhtTimer);
  timerAlarm(timerDHT, 2500000, true, 0);
#else
  timerDHT = timerBegin(0, 80, true);
  timerAttachInterrupt(timerDHT, &onDhtTimer, true);
  timerAlarmWrite(timerDHT, 2500000, true);
  timerAlarmEnable(timerDHT);
#endif
  Serial.println(F("[OK] Hardware Timer DHT22 khoi tao chu ky 2.5s."));

  // Khởi tạo Task FreeRTOS trên 2 nhân riêng biệt
  xTaskCreatePinnedToCore(
    TaskNetwork,        // Hàm xử lý Task
    "TaskNetwork",      // Tên Task
    8192,               // Stack size
    NULL,               // Tham số
    1,                  // Mức ưu tiên
    &TaskNetworkHandle, // Handle
    0                   // CORE 0 (Network)
  );

  xTaskCreatePinnedToCore(
    TaskControl,        // Hàm xử lý Task
    "TaskControl",      // Tên Task
    8192,               // Stack size
    NULL,               // Tham số
    2,                  // Mức ưu tiên cao hơn cho Real-time Control
    &TaskControlHandle, // Handle
    1                   // CORE 1 (Hardware Control)
  );
}

void loop() {
  // Để trống vì toàn bộ logic đã chạy trong 2 Task FreeRTOS
  vTaskDelay(pdMS_TO_TICKS(1000));
}

// ==================== LOGIC KICKSTART & SOFT-RAMP QUẠT ====================
void triggerFanKickstart(int newTargetPwm, unsigned long now) {
  targetFanPwm = newTargetPwm;
  if (targetFanPwm > 0) {
    currentFanState = FAN_STATE_ON;
    if (currentFanPwm == 0) {
      isFanKickstarting = true;
      fanKickStartTime = now;
      currentFanPwm = FAN_KICKSTART_PWM;
      ledcWrite(PIN_MOSFET_FAN, currentFanPwm);
      Serial.println(F("⚡ [FAN] Kich hoat KICKSTART (4095/4095) trong 400ms..."));
    }
  } else {
    currentFanState = FAN_STATE_OFF;
    isFanKickstarting = false;
    currentFanPwm = 0;
    ledcWrite(PIN_MOSFET_FAN, 0);
  }
}

void processFanSpeedRamp(unsigned long now) {
  static unsigned long lastFanRampStep = 0;

  if (targetFanPwm == 0) {
    if (currentFanPwm != 0 || fanBurstModeActive) {
      currentFanPwm = 0;
      isFanKickstarting = false;
      fanBurstModeActive = false;
      ledcWrite(PIN_MOSFET_FAN, 0);
    }
    return;
  }

  if (isFanKickstarting) {
    if (now - fanKickStartTime >= FAN_KICKSTART_DURATION) {
      isFanKickstarting = false;
      Serial.printf("🌀 [FAN] Ket thuc Kickstart, xu ly toc do muc tieu: %d\n", targetFanPwm);
    } else {
      return;
    }
  }

  // TỐC ĐỘ THẤP -> BURST MODE
  if (targetFanPwm < FAN_SUSTAIN_PWM) {
    if (currentFanPwm > FAN_SUSTAIN_PWM) {
      if (now - lastFanRampStep >= 15) {
        lastFanRampStep = now;
        currentFanPwm -= 60;
        if (currentFanPwm < FAN_SUSTAIN_PWM) currentFanPwm = FAN_SUSTAIN_PWM;
        ledcWrite(PIN_MOSFET_FAN, currentFanPwm);
      }
      fanBurstModeActive = false;
      return;
    }

    if (!fanBurstModeActive) {
      fanBurstModeActive = true;
      fanBurstCycleStart = now;
    }

    float ratio = (float)targetFanPwm / (float)FAN_SUSTAIN_PWM;
    if (ratio < FAN_BURST_MIN_RATIO) ratio = FAN_BURST_MIN_RATIO;
    if (ratio > 1.0) ratio = 1.0;

    unsigned long elapsed = now - fanBurstCycleStart;
    if (elapsed >= FAN_BURST_PERIOD_MS) {
      fanBurstCycleStart = now;
      elapsed = 0;
    }

    unsigned long onTime = (unsigned long)(ratio * (float)FAN_BURST_PERIOD_MS);
    int desiredPwm = (elapsed < onTime) ? FAN_SUSTAIN_PWM : FAN_COAST_PWM;

    if (desiredPwm != currentFanPwm) {
      currentFanPwm = desiredPwm;
      ledcWrite(PIN_MOSFET_FAN, currentFanPwm);
    }
    return;
  }

  // TỐC ĐỘ >= SUSTAIN -> RAMP LIÊN TỤC
  fanBurstModeActive = false;
  if (now - lastFanRampStep >= 15) {
    lastFanRampStep = now;
    if (currentFanPwm > targetFanPwm) {
      currentFanPwm -= 60;
      if (currentFanPwm < targetFanPwm) currentFanPwm = targetFanPwm;
      ledcWrite(PIN_MOSFET_FAN, currentFanPwm);
    } else if (currentFanPwm < targetFanPwm) {
      currentFanPwm += 60;
      if (currentFanPwm > targetFanPwm) currentFanPwm = targetFanPwm;
      ledcWrite(PIN_MOSFET_FAN, currentFanPwm);
    }
  }
}

// ==================== STATE MACHINE QUẠT TRONG AUTO MODE ====================
void processFanStateMachine(unsigned long now) {
  bool tempTrigger = (cachedTempIndoor > TEMP_MIN_COMFORT) && ((cachedTempIndoor - cachedTempOutdoor) > TEMP_DIFF_ACTIVATE);
  bool humiTrigger = (cachedHumiIndoor > HUMI_MAX_COMFORT) && ((cachedHumiIndoor - cachedHumiOutdoor) > HUMI_DIFF_ACTIVATE);

  switch (currentFanState) {
    case FAN_STATE_OFF:
      if (tempTrigger || humiTrigger) {
        triggerFanKickstart(4095, now);
        lastFanStateChangeTime = now;
      }
      break;

    case FAN_STATE_ON:
      if (now - lastFanStateChangeTime >= FAN_MIN_RUN_TIME) {
        bool tempResolved = (cachedTempIndoor <= (TEMP_MIN_COMFORT - 0.5)) || 
                            ((cachedTempIndoor - cachedTempOutdoor) <= TEMP_DIFF_DEACTIVATE);
        bool humiResolved = (cachedHumiIndoor <= (HUMI_MAX_COMFORT - 5.0)) || 
                            ((cachedHumiIndoor - cachedHumiOutdoor) <= HUMI_DIFF_DEACTIVATE);

        if (tempResolved && humiResolved) {
          currentFanState = FAN_STATE_COOLDOWN;
          triggerFanKickstart(0, now);
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

// ==================== ĐỌC DỮ LIỆU CẢM BIẾN AN TOÀN ====================
void updateDHTData() {
  float tIn  = dhtIndoor.readTemperature();
  float hIn  = dhtIndoor.readHumidity();
  float tOut = dhtOutdoor.readTemperature();
  float hOut = dhtOutdoor.readHumidity();

  if (!isnan(tIn)) cachedTempIndoor = tIn;
  if (!isnan(hIn)) cachedHumiIndoor = hIn;
  if (!isnan(tOut)) cachedTempOutdoor = tOut;
  if (!isnan(hOut)) cachedHumiOutdoor = hOut;
}

// ==================== STATE MACHINE ĐÈN TRẦN TRONG AUTO MODE ====================
void processIndoorLightingStateMachine(unsigned long now) {
  if (currentPirState == PIR_CONFIRMED_HIGH || currentPirState == PIR_DEBOUNCING_LOW) {
    lastPIRActivityTime = now;
  }

  bool isRoomOccupied = (now - lastPIRActivityTime < LED_ROOM_HOLD_TIME);
  bool isDeskOccupied = (now - lastPIRActivityTime < LED_DESK_HOLD_TIME);

  deskLedState = isDeskOccupied;
  digitalWrite(PIN_MOSFET_LED_DESK, deskLedState ? HIGH : LOW);

  int targetPwm = 0;
  if (isRoomOccupied) {
    if (filteredLuxIndoor < LUX_INDOOR_TARGET) {
      float deficit = LUX_INDOOR_TARGET - filteredLuxIndoor;
      float ratio = deficit / LUX_INDOOR_TARGET;
      targetPwm = (int)(ratio * 4095);
      targetPwm = constrain(targetPwm, 0, 4095);
    } else {
      targetPwm = 0;
    }
  } else {
    targetPwm = 0;
  }

  static unsigned long lastFadeStep = 0;
  if (now - lastFadeStep >= 10) {
    lastFadeStep = now;
    if (currentIndoorPwm < targetPwm) {
      currentIndoorPwm += 60;
      if (currentIndoorPwm > targetPwm) currentIndoorPwm = targetPwm;
    } else if (currentIndoorPwm > targetPwm) {
      currentIndoorPwm -= 25;
      if (currentIndoorPwm < targetPwm) currentIndoorPwm = targetPwm;
    }
    ledcWrite(PIN_MOSFET_LED_IN, currentIndoorPwm);
  }
}

// ==================== CHIẾU SÁNG SÂN VƯỜN ====================
void processOutdoorLighting(unsigned long now) {
  static bool outdoorLightOn = false;
  if (filteredLuxOutdoor < LUX_OUTDOOR_LOW) {
    outdoorLightOn = true;
  } else if (filteredLuxOutdoor > LUX_OUTDOOR_HIGH) {
    outdoorLightOn = false;
  }
  digitalWrite(PIN_MOSFET_LED_OUT, outdoorLightOn ? HIGH : LOW);
}

// ==================== LỌC CHỐNG DỘI PIR ====================
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
          lastPIRActivityTime = now;
        }
      } else {
        currentPirState = PIR_UNCONFIRMED_LOW;
      }
      break;

    case PIR_CONFIRMED_HIGH:
      lastPIRActivityTime = now;
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
        currentPirState = PIR_CONFIRMED_HIGH;
        lastPIRActivityTime = now;
      }
      break;
  }
}

// ==================== WIFI & MQTT HANDLERS ====================
void setupWiFi() {
  Serial.printf("\n[WiFi] Dang ket noi toi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Da ket noi! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println(F("\n[WiFi] Ket noi that bai, tiep tuc thu trong nen."));
  }
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.print(F("[MQTT] Ket noi Broker..."));
  String clientId = "ESP32_CLIMATE_" + String(random(0xffff), HEX);

  const char* willTopic = TOPIC_STATUS;
  const char* willMessage = "{\"status\": \"OFFLINE\"}";

  if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, willTopic, 1, true, willMessage)) {
    Serial.println(F(" THANH CONG!"));
    client.publish(TOPIC_STATUS, "{\"status\": \"ONLINE\"}", true);
    client.subscribe(TOPIC_CONTROL);
  } else {
    Serial.printf(" THAT BAI, rc=%d\n", client.state());
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.printf("[MQTT RX] Loi parse: %s\n", error.c_str());
    return;
  }

  // Lock Mutex khi thay đổi biến điều khiển từ MQTT
  if (xSemaphoreTake(xDataMutex, portMAX_DELAY) == pdTRUE) {
    if (doc.containsKey("mode")) {
      currentMode = doc["mode"].as<String>();
      currentMode.toUpperCase();
      Serial.printf("[MODE] Chuyen sang: %s\n", currentMode.c_str());
    }

    if (doc.containsKey("actuator")) {
      String actuator = doc["actuator"].as<String>();
      String state    = doc.containsKey("state") ? doc["state"].as<String>() : "";

      // 1. Quạt DC
      if (actuator.equalsIgnoreCase("fan")) {
        currentMode = "MANUAL";
        int reqPwm = targetFanPwm;
        if (doc.containsKey("pwm")) {
          reqPwm = constrain(doc["pwm"].as<int>(), 0, 4095);
        } else if (state.equalsIgnoreCase("ON")) {
          reqPwm = 4095;
        } else if (state.equalsIgnoreCase("OFF")) {
          reqPwm = 0;
        }
        triggerFanKickstart(reqPwm, millis());
        Serial.printf("🌀 [FAN TARGET] Toc do mong muon: %d / 4095\n", targetFanPwm);
      }

      // 2. LED trong nhà
      if (actuator.equalsIgnoreCase("led_indoor") || actuator.equalsIgnoreCase("led_in") || actuator.equalsIgnoreCase("led")) {
        currentMode = "MANUAL";
        if (doc.containsKey("pwm")) {
          currentIndoorPwm = constrain(doc["pwm"].as<int>(), 0, 4095);
        } else if (state.equalsIgnoreCase("ON")) {
          currentIndoorPwm = 4095;
        } else if (state.equalsIgnoreCase("OFF")) {
          currentIndoorPwm = 0;
        }
        ledcWrite(PIN_MOSFET_LED_IN, currentIndoorPwm);
        Serial.printf("💡 [LED IN PWM] Do sang: %d / 4095\n", currentIndoorPwm);
      }

      // 3. LED bàn học
      if (actuator.equalsIgnoreCase("led_desk")) {
        currentMode = "MANUAL";
        deskLedState = state.equalsIgnoreCase("ON");
        digitalWrite(PIN_MOSFET_LED_DESK, deskLedState ? HIGH : LOW);
        Serial.printf("📖 [LED DESK] Trang thai: %s\n", deskLedState ? "ON" : "OFF");
      }

      // 4. LED ngoài sân
      if (actuator.equalsIgnoreCase("led_outdoor") || actuator.equalsIgnoreCase("led_out")) {
        digitalWrite(PIN_MOSFET_LED_OUT, state.equalsIgnoreCase("ON") ? HIGH : LOW);
      }
    }

    publishTelemetry();
    xSemaphoreGive(xDataMutex);
  }
}

// ==================== GỬI TELEMETRY ====================
void publishTelemetry() {
  StaticJsonDocument<768> doc;
  doc["device_id"] = "ESP32_CLIMATE_NODE";
  doc["mode"]      = currentMode;

  JsonObject ind = doc.createNestedObject("indoor");
  ind["temperature"] = round(cachedTempIndoor * 10.0) / 10.0;
  ind["humidity"]    = round(cachedHumiIndoor * 10.0) / 10.0;
  ind["lux"]         = (int)round(filteredLuxIndoor);
  ind["motion"]      = (currentPirState == PIR_CONFIRMED_HIGH) ? 1 : 0;

  JsonObject out = doc.createNestedObject("outdoor");
  out["temperature"] = round(cachedTempOutdoor * 10.0) / 10.0;
  out["humidity"]    = round(cachedHumiOutdoor * 10.0) / 10.0;
  out["lux"]         = (int)round(filteredLuxOutdoor);

  doc["fan_state"]      = (targetFanPwm > 0) ? "ON" : "OFF";
  doc["fan_pwm"]        = targetFanPwm;
  doc["led_state"]      = (currentIndoorPwm > 0) ? "ON" : "OFF";
  doc["led_pwm"]        = currentIndoorPwm;
  doc["led_desk_state"] = deskLedState ? "ON" : "OFF";

  String jsonString;
  serializeJson(doc, jsonString);

  // 1. Kiểm tra kết nối MQTT: Nếu MẤT MẠNG -> Đẩy vào bộ đệm (Tối đa 10 phần tử)
  if (!client.connected()) {
    if (telemetryQueue.size() >= MAX_QUEUE_SIZE) {
      telemetryQueue.pop_front(); // Xóa bản tin cũ nhất (FIFO - Drop Oldest)
    }
    telemetryQueue.push_back(jsonString);
    Serial.printf("[BUFFER] Dang mat mang/chap chon. Luu tam vao bo dem (%u/%u)\n", 
                  (unsigned int)telemetryQueue.size(), (unsigned int)MAX_QUEUE_SIZE);
    return;
  }

  // 2. Nếu CÓ MẠNG: Xả sạch toàn bộ bản tin cũ tồn đọng trong bộ đệm
  while (!telemetryQueue.empty()) {
    String bufferedJson = telemetryQueue.front();
    client.publish(TOPIC_TELEMETRY, bufferedJson.c_str());
    telemetryQueue.pop_front();
    delay(50); // Khoảng nghỉ 50ms tránh quá tải socket
    Serial.println(F("[BUFFER] Da gui bu 1 ban tin cu trong bo dem!"));
  }

  // 3. Gửi bản tin thời gian thực hiện tại
  client.publish(TOPIC_TELEMETRY, jsonString.c_str());
  Serial.printf("[MQTT TX] Da publish ban tin hien tai toi %s\n", TOPIC_TELEMETRY);
}

void printSystemTelemetry() {
  Serial.println(F("================ TELEMETRY DATA ================"));
  Serial.printf("Lux Trong Nha: %6.1f lx | Lux Ngoai San: %6.1f lx\n", filteredLuxIndoor, filteredLuxOutdoor);
  Serial.printf("Nhiet do In: %5.1f *C | Out: %5.1f* C | Delta T: %+5.1f*C\n", cachedTempIndoor, cachedTempOutdoor, (cachedTempIndoor - cachedTempOutdoor));
  Serial.printf("Do am    In: %5.1f%% | Out: %5.1f%% | Delta H: %+5.1f%%\n", cachedHumiIndoor, cachedHumiOutdoor, (cachedHumiIndoor - cachedHumiOutdoor));
  Serial.printf("Quat Target: %4d | PWM Thuc te: %4d/4095 %s| LED Tran: %4d | LED Ban: %-3s\n", targetFanPwm, currentFanPwm, fanBurstModeActive ? "(BURST) " : "", currentIndoorPwm, deskLedState ? "ON" : "OFF");
  Serial.println(F("================================================\n"));
}
