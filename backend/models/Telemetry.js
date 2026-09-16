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
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    heatIndex: { type: Number },
    lux: { type: Number, default: 0 },
    motion: { type: Number, enum: Array.of(0, 1), default: 0 }
  },
  // 2. Dữ liệu Ngoài Trời (Outdoor)
  outdoor: {
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    heatIndex: { type: Number },
    lux: { type: Number, default: 0 }
  },
  // 3. Trạng thái cơ cấu chấp hành (PWM 12-bit từ 0 đến 4095)
  actuators: {
    fanState: { type: String, enum: ['ON', 'OFF'], default: 'OFF' },
    fanPwm: { type: Number, min: 0, max: 4095, default: 0 },
    ledState: { type: String, enum: ['ON', 'OFF'], default: 'OFF' },
    ledPwm: { type: Number, min: 0, max: 4095, default: 0 },
    ledDeskState: { type: String, enum: ['ON', 'OFF'], default: 'OFF' }
  },
  // 4. Chế độ vận hành
  mode: {
    type: String,
    enum: ['AUTO', 'MANUAL'],
    default: 'AUTO'
  }
}, {
  timestamps: true
});

// Index phục vụ truy vấn lịch sử nhanh
TelemetrySchema.index({ _id: -1 });

// TTL Index: MongoDB tự động xóa dữ liệu sau 30 ngày
TelemetrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Telemetry', TelemetrySchema);
