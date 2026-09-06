require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mqtt = require('mqtt');
const Telemetry = require('./models/Telemetry');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Cho phép Frontend gọi API mà không bị chặn CORS
app.use(express.json());

// ========================================================
// 1. KẾT NỐI CƠ SỞ DỮ LIỆU MONGODB ATLAS
// ========================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/iot_climate_db';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ [MongoDB Atlas] Kết nối Database thành công!'))
  .catch(err => console.error('❌ [MongoDB Atlas] Lỗi kết nối:', err.message));

// ========================================================
// 2. KẾT NỐI MQTT BROKER (HIVEMQ CLOUD / EMQX)
// ========================================================
const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
const TOPIC_TELEMETRY = process.env.MQTT_TOPIC_TELEMETRY || 'hcmute/iot/climate/telemetry';
const TOPIC_STATUS = process.env.MQTT_TOPIC_STATUS || 'hcmute/iot/climate/status';
const TOPIC_CONTROL = process.env.MQTT_TOPIC_CONTROL || 'hcmute/iot/climate/control';

// Tùy chọn kết nối MQTT có hỗ trợ Username & Password cho HiveMQ
const mqttOptions = {
  clientId: 'nodejs_backend_' + Math.random().toString(16).substring(2, 8),
  clean: true,
  reconnectPeriod: 5000
};

if (process.env.MQTT_USERNAME) {
  mqttOptions.username = process.env.MQTT_USERNAME;
}
if (process.env.MQTT_PASSWORD) {
  mqttOptions.password = process.env.MQTT_PASSWORD;
}

const mqttClient = mqtt.connect(MQTT_BROKER, mqttOptions);

mqttClient.on('connect', () => {
  console.log(`✅ [MQTT Broker] Đã kết nối thành công tới ${MQTT_BROKER}`);
  mqttClient.subscribe([TOPIC_TELEMETRY, TOPIC_STATUS], (err) => {
    if (!err) {
      console.log(`📡 [MQTT Subscribe] Đã lắng nghe topic: ${TOPIC_TELEMETRY} & ${TOPIC_STATUS}`);
      console.log("📩 [ESP32 Gửi Tới]:", message.toString());
    }
  });
});

mqttClient.on('error', (err) => {
  console.error('❌ [MQTT Error]:', err.message);
});

// Xử lý gói tin nhận từ MQTT và lưu vào MongoDB Atlas
mqttClient.on('message', async (topic, message) => {
  if (topic === TOPIC_TELEMETRY) {
    try {
      const payload = JSON.parse(message.toString());
      
      // Chuẩn hóa dữ liệu gói tin Trong & Ngoài
      const ind = payload.indoor || payload.in || {};
      const out = payload.outdoor || payload.out || {};

      const record = new Telemetry({
        deviceId: payload.device_id || 'ESP32_CLIMATE_NODE',
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        indoor: {
          temperature: Number(ind.temperature || payload.temperature || 0),
          humidity: Number(ind.humidity || payload.humidity || 0),
          heatIndex: Number(ind.heat_index || calculateHeatIndex(ind.temperature, ind.humidity)),
          lux: Math.round(Number(ind.lux || 0)),
          motion: (ind.motion === 1 || ind.motion === true) ? 1 : 0
        },
        outdoor: {
          temperature: Number(out.temperature || 0),
          humidity: Number(out.humidity || 0),
          heatIndex: Number(out.heat_index || calculateHeatIndex(out.temperature, out.humidity)),
          lux: Math.round(Number(out.lux || 0))
        },
        actuators: {
          fanState: payload.fan_state || 'OFF',
          fanPwm: Number(payload.fan_pwm || 0),
          ledState: payload.led_state || 'OFF',
          ledPwm: Number(payload.led_pwm || 0)
        },
        mode: (payload.mode || 'AUTO').toUpperCase()
      });

      await record.save();
      console.log(`💾 [MongoDB Saved] Bản ghi mới | Trong: ${record.indoor.temperature}°C, ${record.indoor.humidity}% | Ngoài: ${record.outdoor.temperature}°C, ${record.outdoor.lux}Lux`);
    } catch (err) {
      console.error('❌ [Lỗi lưu dữ liệu]:', err.message);
    }
  }
});

// Hàm hỗ trợ tính Heat Index nếu gói tin chưa tính
function calculateHeatIndex(T, RH) {
  if (!T || !RH) return 0;
  return Number((T + 0.33 * (RH / 100 * 6.105 * Math.exp(17.27 * T / (237.7 + T))) - 4.0).toFixed(1));
}

// ========================================================
// 3. HỆ THỐNG CỔNG REST API CHO FRONTEND
// ========================================================

// API Kiểm tra trạng thái Server & Database
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    serverTime: new Date(),
    mongoConnected: mongoose.connection.readyState === 1,
    mqttConnected: mqttClient.connected
  });
});

// API 1: Lấy bản ghi vi khí hậu mới nhất
app.get('/api/v1/telemetry/latest', async (req, res) => {
  try {
    const latestData = await Telemetry.findOne().sort({ timestamp: -1 });
    if (!latestData) {
      return res.status(404).json({ success: false, message: 'Chưa có dữ liệu nào trong cơ sở dữ liệu.' });
    }
    res.json({ success: true, data: latestData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API 2: Lấy dữ liệu lịch sử phục vụ vẽ biểu đồ (Mặc định 60 mốc = 1 giờ gần đây)
app.get('/api/v1/telemetry/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 60; // Mặc định 60 điểm cho 1 giờ
    const history = await Telemetry.find()
      .sort({ timestamp: -1 })
      .limit(limit);

    // Đảo ngược lại theo thứ tự thời gian tăng dần để Chart.js vẽ từ trái sang phải
    const sortedHistory = history.reverse();
    res.json({
      success: true,
      count: sortedHistory.length,
      data: sortedHistory
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API 3: Thống kê trung bình, Min, Max trong khoảng thời gian
app.get('/api/v1/telemetry/stats', async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const stats = await Telemetry.aggregate([
      { $match: { timestamp: { $gte: oneHourAgo } } },
      {
        $group: {
          _id: null,
          avgIndoorTemp: { $avg: '$indoor.temperature' },
          avgIndoorHumid: { $avg: '$indoor.humidity' },
          avgIndoorLux: { $avg: '$indoor.lux' },
          avgOutdoorTemp: { $avg: '$outdoor.temperature' },
          avgOutdoorHumid: { $avg: '$outdoor.humidity' },
          avgOutdoorLux: { $avg: '$outdoor.lux' },
          motionCount: { $sum: '$indoor.motion' },
          totalSamples: { $sum: 1 }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({ success: true, message: 'Chưa có đủ dữ liệu trong 1 giờ qua.' });
    }

    res.json({ success: true, data: stats[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API 4: Gửi lệnh điều khiển thiết bị (Manual Override) từ Web qua HTTP REST
app.post('/api/v1/control', (req, res) => {
  const { actuator, state, pwm, mode } = req.body;
  const cmdPayload = {};
  if (actuator) cmdPayload.actuator = actuator;
  if (state) cmdPayload.state = state;
  if (pwm !== undefined) cmdPayload.pwm = Number(pwm);
  if (mode) cmdPayload.mode = mode;

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(TOPIC_CONTROL, JSON.stringify(cmdPayload), { qos: 1 }, (err) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Lỗi gửi lệnh qua MQTT' });
      }
      res.json({ success: true, message: 'Đã gửi lệnh điều khiển xuống ESP32!', payload: cmdPayload });
    });
  } else {
    res.status(503).json({ success: false, error: 'MQTT Broker chưa sẵn sàng kết nối.' });
  }
});

// Khởi chạy HTTP Server
app.listen(PORT, () => {
  console.log(`🚀 [Node.js Server] Đang chạy tại cổng http://localhost:${PORT}`);
  console.log(`📖 Endpoint lịch sử 1h: http://localhost:${PORT}/api/v1/telemetry/history?limit=60`);
  console.log(`📖 Endpoint dữ liệu mới nhất: http://localhost:${PORT}/api/v1/telemetry/latest`);
});