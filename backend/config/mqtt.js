const mqtt = require('mqtt');
const Telemetry = require('../models/Telemetry');
const { getIO } = require('../sockets/socketHandler');

const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtts://5b48de2a237d43edbd050421370acd77.s1.eu.hivemq.cloud:8883';
const TOPIC_TELEMETRY = process.env.MQTT_TOPIC_TELEMETRY || 'hcmute/iot/climate/telemetry';
const TOPIC_STATUS = process.env.MQTT_TOPIC_STATUS || 'hcmute/iot/climate/status';
const TOPIC_CONTROL = process.env.MQTT_TOPIC_CONTROL || 'hcmute/iot/climate/control';

function calculateHeatIndex(T, RH) {
  const numT = Number(T);
  const numRH = Number(RH);
  if (!numT || !numRH || isNaN(numT) || isNaN(numRH)) return 0;
  return Number((numT + 0.33 * (numRH / 100 * 6.105 * Math.exp(17.27 * numT / (237.7 + numT))) - 4.0).toFixed(1));
}

let mqttClient;

const connectMQTT = () => {
  const mqttOptions = {
    clientId: 'nodejs_backend_' + Math.random().toString(16).substring(2, 8),
    clean: true,
    reconnectPeriod: 5000,
    rejectUnauthorized: true
  };

  if (process.env.MQTT_USERNAME) mqttOptions.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) mqttOptions.password = process.env.MQTT_PASSWORD;

  mqttClient = mqtt.connect(MQTT_BROKER, mqttOptions);

  mqttClient.on('connect', () => {
    console.log(`✅ [HiveMQ Cloud] Đã kết nối thành công tới ${MQTT_BROKER}`);
    mqttClient.subscribe([TOPIC_TELEMETRY, TOPIC_STATUS, TOPIC_CONTROL], (err) => {
      if (!err) {
        console.log(`📡 [MQTT Subscribe] Đang lắng nghe: ${TOPIC_TELEMETRY}, ${TOPIC_STATUS}, ${TOPIC_CONTROL}`);
      }
    });
  });

  mqttClient.on('error', (err) => console.error('❌ [MQTT Error]:', err.message));

  mqttClient.on('message', async (topic, message) => {
    const rawMsg = message.toString();

    if (topic === TOPIC_TELEMETRY) {
      try {
        const payload = JSON.parse(rawMsg);
        const ind = payload.indoor || payload.in || {};
        const out = payload.outdoor || payload.out || {};

        const deviceId = payload.device_id || 'ESP32_CLIMATE_NODE';
        const mode = String(payload.mode || 'AUTO').toUpperCase();

        const inTemp = Number(ind.temperature ?? payload.temperature ?? 0);
        const inHumid = Number(ind.humidity ?? payload.humidity ?? 0);
        const inHeat = Number(ind.heat_index ?? calculateHeatIndex(inTemp, inHumid));
        const inLux = Math.round(Number(ind.lux ?? 0));
        const inMotion = (ind.motion === 1 || ind.motion === true || ind.motion === '1') ? 1 : 0;

        const outTemp = Number(out.temperature ?? 0);
        const outHumid = Number(out.humidity ?? 0);
        const outHeat = Number(out.heat_index ?? calculateHeatIndex(outTemp, outHumid));
        const outLux = Math.round(Number(out.lux ?? 0));

        const fanState = String(payload.fan_state || 'OFF').toUpperCase();
        const fanPwm = Number(payload.fan_pwm || 0);
        const ledState = String(payload.led_state || 'OFF').toUpperCase();
        const ledPwm = Number(payload.led_pwm || 0);
        // Trích xuất trạng thái Đèn Bàn
        const ledDeskState = String(payload.led_desk_state || payload.led_desk || 'OFF').toUpperCase();

        const diffTemp = (inTemp - outTemp).toFixed(1);
        const diffHumid = Math.round(inHumid - outHumid);
        const diffLux = inLux - outLux;

        const timeNow = new Date().toLocaleTimeString('vi-VN');
        console.log(`\n================== [TELEMETRY RECEIVED: ${timeNow}] ==================`);
        console.log(`📱 Thiết Bị (ID)     : ${deviceId} | Mode: ${mode}`);
        console.log(`🏠 Trong Nhà         : ${inTemp.toFixed(1)}°C | ${inHumid.toFixed(1)}% | ${inLux} Lux | PIR: ${inMotion}`);
        console.log(`☀️  Ngoài Trời        : ${outTemp.toFixed(1)}°C | ${outHumid.toFixed(1)}% | ${outLux} Lux`);
        console.log(`⚡ Thiết Bị          : Quạt: ${fanState} (${fanPwm}) | Đèn Trần: ${ledState} (${ledPwm}) | Đèn Bàn: ${ledDeskState}`);
        console.log(`==================================================================\n`);

        let recordTimestamp = new Date();
        if (payload.timestamp && Number(payload.timestamp) > 1000000000000) {
          recordTimestamp = new Date(Number(payload.timestamp));
        }

        const record = new Telemetry({
          deviceId: deviceId,
          timestamp: recordTimestamp,
          indoor: {
            temperature: inTemp,
            humidity: inHumid,
            heatIndex: inHeat,
            lux: inLux,
            motion: inMotion
          },
          outdoor: {
            temperature: outTemp,
            humidity: outHumid,
            heatIndex: outHeat,
            lux: outLux
          },
          actuators: {
            fanState: fanState,
            fanPwm: fanPwm,
            ledState: ledState,
            ledPwm: ledPwm,
            ledDeskState: ledDeskState
          },
          mode: mode
        });

        const savedRecord = await record.save();
        console.log(`💾 [MongoDB Saved] Đã lưu bản ghi ID: ${savedRecord._id}`);

        // Phát Plain Object qua Socket.io
        getIO().emit('telemetry_update', savedRecord.toObject());

      } catch (err) {
        console.error('❌ [Lỗi JSON Parsing/MongoDB]:', err.message);
      }
    }
  });

  return mqttClient;
};

const getMQTTClient = () => mqttClient;

module.exports = { connectMQTT, getMQTTClient, TOPIC_CONTROL };