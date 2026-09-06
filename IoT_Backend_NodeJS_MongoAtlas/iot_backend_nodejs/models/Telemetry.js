const mongoose = require('mongoose');

// Schema dữ liệu lưu trữ vi khí hậu Trong Nhà & Ngoài Trời
const TelemetrySchema = new mongoose.Schema({
  deviceId: {
    type: String,
    default: 'ESP32_CLIMATE_NODE',
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // 1. Dữ liệu Trong Nhà (Indoor)
  indoor: {
    temperature: { type: Number, required: true }, // °C (DHT22 Inside)
    humidity: { type: Number, required: true },    // %RH (DHT22 Inside)
    heatIndex: { type: Number },                   // °C (Chỉ số cảm giác nhiệt)
    lux: { type: Number, default: 0 },             // Lux (BH1750 Inside)
    motion: { type: Number, enum: [0, 1], default: 0 } // 1: Có người, 0: Trống (PIR)
  },
  // 2. Dữ liệu Ngoài Trời (Outdoor)
  outdoor: {
    temperature: { type: Number, required: true }, // °C (DHT22 Outside)
    humidity: { type: Number, required: true },    // %RH (DHT22 Outside)
    heatIndex: { type: Number },                   // °C
    lux: { type: Number, default: 0 }              // Lux (BH1750 Outside)
  },
  // 3. Trạng thái cơ cấu chấp hành tại thời điểm đo
  actuators: {
    fanState: { type: String, enum: ['ON', 'OFF'], default: 'OFF' },
    fanPwm: { type: Number, min: 0, max: 100, default: 0 },
    ledState: { type: String, enum: ['ON', 'OFF'], default: 'OFF' },
    ledPwm: { type: Number, min: 0, max: 100, default: 0 }
  },
  // 4. Chế độ vận hành
  mode: {
    type: String,
    enum: ['AUTO', 'MANUAL'],
    default: 'AUTO'
  }
}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

// Tạo index phục vụ truy vấn lịch sử 1 giờ nhanh nhất
TelemetrySchema.index({ timestamp: -1 });

module.exports = mongoose.model('Telemetry', TelemetrySchema);
