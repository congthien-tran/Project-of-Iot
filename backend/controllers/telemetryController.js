const mongoose = require('mongoose');
const Telemetry = require('../models/Telemetry');
const { getMQTTClient, TOPIC_CONTROL } = require('../config/mqtt');

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
    const limit = parseInt(req.query.limit) || 60;
    const history = await Telemetry.find().sort({ timestamp: -1 }).limit(limit);
    res.json({ success: true, count: history.length, data: history.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.sendControl = (req, res) => {
  const { actuator, state, pwm, mode } = req.body;
  const cmdPayload = {};
  if (actuator) cmdPayload.actuator = actuator;
  if (state) cmdPayload.state = state;
  if (pwm !== undefined) cmdPayload.pwm = Number(pwm);
  if (mode) cmdPayload.mode = mode;

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
