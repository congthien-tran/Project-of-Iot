const mongoose = require('mongoose');
const Telemetry = require('../models/Telemetry');
const { getMQTTClient, TOPIC_CONTROL } = require('../config/mqtt');

const MAX_HISTORY_LIMIT = 500;
const PWM_MAX = 4095;
const VALID_ACTUATORS = ['fan', 'led_indoor', 'led_in', 'led', 'led_desk', 'led_outdoor', 'led_out'];
const VALID_STATES = ['ON', 'OFF'];
const VALID_MODES = ['AUTO', 'MANUAL'];

exports.getHealth = (req, res) => {
  const mqttClient = getMQTTClient();
  res.json({
    status: 'ONLINE',
    serverTime: new Date(),
    mongoConnected: mongoose.connection.readyState === 1,
    mqttConnected: mqttClient ? mqttClient.connected : false
  });
};

exports.getLatest = async (req, res) => {
  try {
    const latestData = await Telemetry.findOne().sort({ timestamp: -1 });
    if (!latestData) return res.status(404).json({ success: false, message: 'Chưa có dữ liệu.' });
    res.json({ success: true, data: latestData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 60, 1), MAX_HISTORY_LIMIT);
    const history = await Telemetry.find().sort({ timestamp: -1 }).limit(limit);
    res.json({ success: true, count: history.length, data: history.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.sendControl = (req, res) => {
  const { actuator, state, pwm, mode } = req.body || {};
  const cmdPayload = {};
  const badRequest = (error) => res.status(400).json({ success: false, error });

  if (actuator !== undefined) {
    if (!VALID_ACTUATORS.includes(actuator)) return badRequest(`actuator không hợp lệ: ${actuator}`);
    cmdPayload.actuator = actuator;
  }
  if (state !== undefined) {
    const s = String(state).toUpperCase();
    if (!VALID_STATES.includes(s)) return badRequest('state phải là ON hoặc OFF');
    cmdPayload.state = s;
  }
  if (pwm !== undefined) {
    const p = Number(pwm);
    if (!Number.isInteger(p) || p < 0 || p > PWM_MAX) return badRequest(`pwm phải là số nguyên 0-${PWM_MAX}`);
    cmdPayload.pwm = p;
  }
  if (mode !== undefined) {
    const m = String(mode).toUpperCase();
    if (!VALID_MODES.includes(m)) return badRequest('mode phải là AUTO hoặc MANUAL');
    cmdPayload.mode = m;
  }
  // Payload rỗng {} (vd. nút "Test Ping") vẫn được gửi: ESP32 sẽ phản hồi ngay bằng 1 gói telemetry.

  const mqttClient = getMQTTClient();
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(TOPIC_CONTROL, JSON.stringify(cmdPayload), { qos: 1 }, (err) => {
      if (err) return res.status(500).json({ success: false, error: 'Lỗi gửi MQTT' });
      res.json({ success: true, message: 'Đã gửi lệnh xuống ESP32!', payload: cmdPayload });
    });
  } else {
    res.status(503).json({ success: false, error: 'MQTT Broker chưa kết nối.' });
  }
};
