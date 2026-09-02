/**
 * ==============================================================================
 * HỆ THỐNG GIÁM SÁT MÔI TRƯỜNG & KHÍ HẬU 2 PHÒNG ĐỘC LẬP - IOT DASHBOARD
 * Thành viên 3: Dashboard & Frontend Lead (Nguyễn Nhật Minh)
 * ==============================================================================
 * Quản lý 2 phòng riêng biệt:
 * - Phòng 1: Phòng Khách (Tầng 1) -> 3 cảm biến (DHT22, BH1750, PIR) + 1 Quạt + 1 Đèn
 * - Phòng 2: Phòng Ngủ (Tầng 2)  -> 3 cảm biến (DHT22, BH1750, PIR) + 1 Quạt + 1 Đèn
 * ==============================================================================
 */

// ==========================================
// 1. CẤU HÌNH & TRẠNG THÁI 2 PHÒNG
// ==========================================
let mqttConfig = {
  host: "broker.emqx.io",
  port: 8083,
  path: "/mqtt",
  clientId: "web_2rooms_" + Math.random().toString(16).substring(2, 8),
  topicTelemetry: "hcmute/iot/climate/telemetry",
  topicStatus: "hcmute/iot/climate/status",
  topicCommand: "hcmute/iot/climate/control"
};

let mqttClient = null;
let roomsChart = null;
let currentMetric = "temp"; // "temp", "humid", "lux"

// Trạng thái độc lập của 2 phòng
let systemState = {
  isOnline: false,
  lastTelemetryTime: null,
  lastCommandSentTime: 0,
  rooms: {
    1: {
      name: "Phòng Khách (Tầng 1)",
      mode: "AUTO",
      temp: 0,
      humid: 0,
      heatIndex: 0,
      lux: 0,
      motion: 0,
      fanState: false,
      fanPwm: 0,
      ledState: false,
      ledPwm: 0
    },
    2: {
      name: "Phòng Ngủ (Tầng 2)",
      mode: "AUTO",
      temp: 0,
      humid: 0,
      heatIndex: 0,
      lux: 0,
      motion: 0,
      fanState: false,
      fanPwm: 0,
      ledState: false,
      ledPwm: 0
    }
  }
};

let isSimulating = false;
let simulationTimer = null;

// ==========================================
// 2. KHỞI TẠO BIỂU ĐỒ SO SÁNH 2 PHÒNG (CHART.JS)
// ==========================================
function initChart() {
  const ctx = document.getElementById("roomsChart").getContext("2d");

  roomsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "P.Khách (Tầng 1)",
          data: [],
          borderColor: "#6366f1", // Màu chàm Indigo
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 2
        },
        {
          label: "P.Ngủ (Tầng 2)",
          data: [],
          borderColor: "#10b981", // Màu xanh lục Emerald
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          borderDash: [5, 5],     // Đường đứt nét để phân biệt phòng ngủ
          tension: 0.3,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { family: "Inter", size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(51, 65, 85, 0.3)" },
          ticks: { color: "#64748b", font: { size: 10 } }
        },
        y: {
          grid: { color: "rgba(51, 65, 85, 0.2)" },
          ticks: { color: "#94a3b8", callback: (val) => val + "°C" }
        }
      }
    }
  });
}

// Thêm dữ liệu vào biểu đồ
function addRoomsDataToChart(timeStr, r1Val, r2Val) {
  if (!roomsChart) return;
  const maxPoints = 15;
  roomsChart.data.labels.push(timeStr);
  roomsChart.data.datasets[0].data.push(r1Val);
  roomsChart.data.datasets[1].data.push(r2Val);

  if (roomsChart.data.labels.length > maxPoints) {
    roomsChart.data.labels.shift();
    roomsChart.data.datasets[0].data.shift();
    roomsChart.data.datasets[1].data.shift();
  }
  roomsChart.update("none");
}

// Đổi loại dữ liệu so sánh (Nhiệt độ / Độ ẩm / Ánh sáng)
function switchChartMetric(metric) {
  currentMetric = metric;
  if (!roomsChart) return;

  if (metric === "temp") {
    roomsChart.data.datasets[0].label = "Nhiệt độ P.Khách (°C)";
    roomsChart.data.datasets[0].borderColor = "#f97316";
    roomsChart.data.datasets[1].label = "Nhiệt độ P.Ngủ (°C)";
    roomsChart.data.datasets[1].borderColor = "#fb923c";
    roomsChart.options.scales.y.ticks.callback = (val) => val + "°C";
  } else if (metric === "humid") {
    roomsChart.data.datasets[0].label = "Độ ẩm P.Khách (%)";
    roomsChart.data.datasets[0].borderColor = "#06b6d4";
    roomsChart.data.datasets[1].label = "Độ ẩm P.Ngủ (%)";
    roomsChart.data.datasets[1].borderColor = "#38bdf8";
    roomsChart.options.scales.y.ticks.callback = (val) => val + "%";
  } else if (metric === "lux") {
    roomsChart.data.datasets[0].label = "Ánh sáng P.Khách (Lux)";
    roomsChart.data.datasets[0].borderColor = "#eab308";
    roomsChart.data.datasets[1].label = "Ánh sáng P.Ngủ (Lux)";
    roomsChart.data.datasets[1].borderColor = "#fde047";
    roomsChart.options.scales.y.ticks.callback = (val) => val + " Lux";
  }
  roomsChart.update();
}

// ==========================================
// 3. KẾT NỐI MQTT BROKER QUA WEBSOCKET
// ==========================================
function connectMQTT() {
  logToConsole(`[MQTT] Đang kết nối tới ${mqttConfig.host}:${mqttConfig.port}...`);
  try {
    mqttClient = new Paho.MQTT.Client(
      mqttConfig.host,
      Number(mqttConfig.port),
      mqttConfig.path,
      mqttConfig.clientId
    );
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;

    const options = {
      timeout: 5,
      useSSL: mqttConfig.port === 8084 || mqttConfig.port === 443,
      cleanSession: true,
      onSuccess: onConnectSuccess,
      onFailure: onConnectFailure
    };
    mqttClient.connect(options);
  } catch (err) {
    logToConsole(`[Lỗi] Khởi tạo MQTT thất bại: ${err.message}`);
  }
}

function onConnectSuccess() {
  logToConsole(`[MQTT] Kết nối Broker thành công!`);
  mqttClient.subscribe(mqttConfig.topicTelemetry, { qos: 0 });
  mqttClient.subscribe(mqttConfig.topicStatus, { qos: 1 });
}

function onConnectFailure(res) {
  logToConsole(`[MQTT] Kết nối thất bại: ${res.errorMessage}`);
  setDeviceOnlineStatus(false);
}

function onConnectionLost(res) {
  if (res.errorCode !== 0) logToConsole(`[MQTT] Mất kết nối: ${res.errorMessage}`);
  setDeviceOnlineStatus(false);
}

// ==========================================
// 4. XỬ LÝ GÓI TIN TELEMETRY 2 PHÒNG
// ==========================================
function onMessageArrived(message) {
  const topic = message.destinationName;
  const payloadStr = message.payloadString;

  if (topic === mqttConfig.topicStatus) {
    setDeviceOnlineStatus(payloadStr.toLowerCase().includes("online"));
    return;
  }

  if (topic === mqttConfig.topicTelemetry) {
    try {
      const data = JSON.parse(payloadStr);
      process2RoomsTelemetry(data);
    } catch (e) {
      logToConsole(`[Cảnh báo] Gói tin không phải JSON hợp lệ.`);
    }
  }
}

function process2RoomsTelemetry(data) {
  const now = Date.now();
  systemState.lastTelemetryTime = now;
  setDeviceOnlineStatus(true);

  // 1. Tính Telemetry Latency
  if (data.timestamp) {
    let packetTime = Number(data.timestamp);
    if (!isNaN(packetTime) && packetTime > 1000000000000) {
      let latency = Math.max(0, now - packetTime);
      document.getElementById("telemetry-latency-val").innerText = latency + " ms";
    } else {
      document.getElementById("telemetry-latency-val").innerText = "< 45 ms";
    }
  }

  // 2. Cập nhật Phòng 1 (Phòng Khách)
  const r1 = data.room1 || (data.room === 1 ? data : null) || data;
  if (r1) {
    updateRoomUI(1, r1);
  }

  // 3. Cập nhật Phòng 2 (Phòng Ngủ)
  const r2 = data.room2 || (data.room === 2 ? data : null);
  if (r2) {
    updateRoomUI(2, r2);
  }

  // 4. Cập nhật Biểu đồ so sánh
  const timeStr = new Date().toLocaleTimeString("vi-VN", { hour12: false });
  let val1 = 0, val2 = 0;
  if (currentMetric === "temp") {
    val1 = systemState.rooms[1].temp;
    val2 = systemState.rooms[2].temp;
  } else if (currentMetric === "humid") {
    val1 = systemState.rooms[1].humid;
    val2 = systemState.rooms[2].humid;
  } else if (currentMetric === "lux") {
    val1 = systemState.rooms[1].lux;
    val2 = systemState.rooms[2].lux;
  }
  addRoomsDataToChart(timeStr, val1, val2);

  // 5. Kiểm tra cảnh báo vượt ngưỡng
  checkAlarms();

  // 6. Tính Command Response Time nếu vừa gửi lệnh
  if (systemState.lastCommandSentTime > 0) {
    const responseTime = now - systemState.lastCommandSentTime;
    document.getElementById("command-latency-val").innerText = responseTime + " ms";
    systemState.lastCommandSentTime = 0;
    logToConsole(`[Command Ack] Nhận phản hồi thực thi sau ${responseTime} ms`);
  }
}

// Cập nhật giao diện của từng phòng (id = 1 hoặc 2)
function updateRoomUI(roomId, roomData) {
  const p = roomId === 1 ? "r1" : "r2";
  const stateObj = systemState.rooms[roomId];

  // Nhiệt độ & Độ ẩm (DHT22)
  if (roomData.temperature !== undefined) {
    stateObj.temp = Number(roomData.temperature);
    document.getElementById(`${p}-temp`).innerText = stateObj.temp.toFixed(1);
  }
  if (roomData.humidity !== undefined) {
    stateObj.humid = Number(roomData.humidity);
    document.getElementById(`${p}-humid`).innerText = Math.round(stateObj.humid);
  }

  // Heat Index
  stateObj.heatIndex = roomData.heat_index !== undefined ? Number(roomData.heat_index) : calculateHeatIndex(stateObj.temp, stateObj.humid);
  document.getElementById(`${p}-heat-index`).innerText = stateObj.heatIndex.toFixed(1) + " °C";

  // Cường độ sáng (BH1750)
  if (roomData.lux !== undefined) {
    stateObj.lux = Math.round(roomData.lux);
    document.getElementById(`${p}-lux`).innerText = stateObj.lux;
    const statusElem = document.getElementById(`${p}-lux-status`);
    if (stateObj.lux < 100) {
      statusElem.innerText = "Tối (Bật đèn)";
      statusElem.className = "text-amber-400 font-medium";
    } else {
      statusElem.innerText = "Đủ sáng";
      statusElem.className = "text-emerald-400 font-medium";
    }
  }

  // Cảm biến chuyển động (PIR HC-SR501)
  if (roomData.motion !== undefined) {
    stateObj.motion = roomData.motion;
    const pirBadge = document.getElementById(`${p}-pir-badge`);
    const isOccupied = roomData.motion === 1 || roomData.motion === true;
    if (isOccupied) {
      pirBadge.innerText = "PHÁT HIỆN CÓ NGƯỜI";
      pirBadge.className = "block text-center py-1.5 px-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse";
    } else {
      pirBadge.innerText = "Không có người";
      pirBadge.className = "block text-center py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700";
    }
  }

  // Quạt DC (MOSFET)
  if (roomData.fan_state !== undefined || roomData.fan_pwm !== undefined) {
    stateObj.fanState = roomData.fan_state === "ON" || roomData.fan_state === 1 || roomData.fan_state === true;
    stateObj.fanPwm = roomData.fan_pwm !== undefined ? Number(roomData.fan_pwm) : (stateObj.fanState ? 80 : 0);

    const badge = document.getElementById(`${p}-fan-badge`);
    const btn = document.getElementById(`${p}-btn-fan`);
    const slider = document.getElementById(`${p}-fan-slider`);
    const label = document.getElementById(`${p}-fan-pwm-label`);

    if (stateObj.fanState && stateObj.fanPwm > 0) {
      badge.innerText = `ON (${stateObj.fanPwm}%)`;
      badge.className = "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30";
      btn.innerText = "TẮT";
      btn.className = "flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition";
    } else {
      badge.innerText = "OFF";
      badge.className = "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400";
      btn.innerText = "BẬT";
      btn.className = "flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition";
    }
    slider.value = stateObj.fanPwm;
    label.innerText = `${stateObj.fanPwm}%`;
  }

  // Đèn LED (BJT)
  if (roomData.led_state !== undefined || roomData.led_pwm !== undefined) {
    stateObj.ledState = roomData.led_state === "ON" || roomData.led_state === 1 || roomData.led_state === true;
    stateObj.ledPwm = roomData.led_pwm !== undefined ? Number(roomData.led_pwm) : (stateObj.ledState ? 100 : 0);

    const badge = document.getElementById(`${p}-led-badge`);
    const btn = document.getElementById(`${p}-btn-led`);
    const slider = document.getElementById(`${p}-led-slider`);
    const label = document.getElementById(`${p}-led-pwm-label`);

    if (stateObj.ledState && stateObj.ledPwm > 0) {
      badge.innerText = `ON (${stateObj.ledPwm}%)`;
      badge.className = "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30";
      btn.innerText = "TẮT";
      btn.className = "flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition";
    } else {
      badge.innerText = "OFF";
      badge.className = "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400";
      btn.innerText = "BẬT";
      btn.className = "flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition";
    }
    slider.value = stateObj.ledPwm;
    label.innerText = `${stateObj.ledPwm}%`;
  }

  // Chế độ Auto / Manual của phòng
  if (roomData.mode) {
    stateObj.mode = roomData.mode.toUpperCase();
    const btnAuto = document.getElementById(`${p}-btn-auto`);
    const btnManual = document.getElementById(`${p}-btn-manual`);
    const colorClass = roomId === 1 ? "bg-indigo-600" : "bg-emerald-600";

    if (stateObj.mode === "AUTO") {
      btnAuto.className = `px-3 py-1 rounded-lg text-xs font-semibold ${colorClass} text-white shadow-md transition`;
      btnManual.className = "px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition";
    } else {
      btnManual.className = "px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 text-white shadow-md transition";
      btnAuto.className = "px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition";
    }
  }
}

// ==========================================
// 5. GỬI LỆNH ĐIỀU KHIỂN THEO PHÒNG
// ==========================================
function sendRoomCommand(roomId, commandPayload) {
  commandPayload.room = roomId; // Đính kèm ID phòng (1 hoặc 2)
  systemState.lastCommandSentTime = Date.now();
  const payloadStr = JSON.stringify(commandPayload);

  if (mqttClient && mqttClient.isConnected()) {
    const msg = new Paho.MQTT.Message(payloadStr);
    msg.destinationName = mqttConfig.topicCommand;
    msg.qos = 1;
    mqttClient.send(msg);
    logToConsole(`[Lệnh P.${roomId}] -> ${payloadStr}`);
  } else {
    logToConsole(`[Mô phỏng P.${roomId}] Chưa kết nối MQTT -> Thực thi cục bộ`);
    if (isSimulating) {
      setTimeout(() => {
        updateRoomUI(roomId, commandPayload);
        document.getElementById("command-latency-val").innerText = "28 ms";
      }, 28);
    }
  }
}

// Chuyển chế độ Auto / Manual riêng cho từng phòng
function setRoomMode(roomId, mode) {
  systemState.rooms[roomId].mode = mode;
  updateRoomUI(roomId, { mode: mode });
  sendRoomCommand(roomId, { mode: mode });
}

// Bật/Tắt Quạt phòng
function toggleRoomActuator(roomId, actuator) {
  const stateObj = systemState.rooms[roomId];
  if (actuator === "fan") {
    const nextState = !stateObj.fanState;
    const nextPwm = nextState ? 80 : 0;
    updateRoomUI(roomId, { fan_state: nextState ? "ON" : "OFF", fan_pwm: nextPwm });
    sendRoomCommand(roomId, { actuator: "fan", state: nextState ? "ON" : "OFF", pwm: nextPwm });
  } else if (actuator === "led") {
    const nextState = !stateObj.ledState;
    const nextPwm = nextState ? 100 : 0;
    updateRoomUI(roomId, { led_state: nextState ? "ON" : "OFF", led_pwm: nextPwm });
    sendRoomCommand(roomId, { actuator: "led", state: nextState ? "ON" : "OFF", pwm: nextPwm });
  }
}

function onRoomSliderInput(roomId, actuator, val) {
  const p = roomId === 1 ? "r1" : "r2";
  document.getElementById(`${p}-${actuator}-pwm-label`).innerText = `${val}%`;
}

function sendRoomPWM(roomId, actuator, val) {
  const pwmNum = Number(val);
  const stateStr = pwmNum > 0 ? "ON" : "OFF";
  const patch = {};
  patch[`${actuator}_state`] = stateStr;
  patch[`${actuator}_pwm`] = pwmNum;
  updateRoomUI(roomId, patch);
  sendRoomCommand(roomId, { actuator: actuator, state: stateStr, pwm: pwmNum });
}

function pingLatencyTest() {
  const pingPayload = { ping: Date.now() };
  if (mqttClient && mqttClient.isConnected()) {
    const msg = new Paho.MQTT.Message(JSON.stringify(pingPayload));
    msg.destinationName = mqttConfig.topicCommand;
    mqttClient.send(msg);
  }
  logToConsole(`[Ping Test] Đã gửi gói kiểm tra độ trễ`);
}

// ==========================================
// 6. TIỆN ÍCH & CẢNH BÁO
// ==========================================
function checkAlarms() {
  const banner = document.getElementById("alarm-banner");
  const msg = document.getElementById("alarm-message");
  const r1 = systemState.rooms[1];
  const r2 = systemState.rooms[2];

  let alarms = [];
  if (r1.temp > 35 || r1.heatIndex > 38) alarms.push("P.Khách quá nóng (Nhiệt/Heat Index cao)");
  if (r1.humid > 85) alarms.push("P.Khách nồm ẩm (>85%)");
  if (r2.temp > 34 || r2.heatIndex > 37) alarms.push("P.Ngủ nhiệt độ cao");

  if (alarms.length > 0) {
    banner.classList.remove("hidden");
    msg.innerText = "Cảnh báo: " + alarms.join(" | ");
  } else {
    banner.classList.add("hidden");
  }
}

function calculateHeatIndex(T, RH) {
  if (!T || !RH) return 0;
  return T + 0.33 * (RH / 100 * 6.105 * Math.exp(17.27 * T / (237.7 + T))) - 4.0;
}

function setDeviceOnlineStatus(isOnline) {
  systemState.isOnline = isOnline;
  const dot = document.getElementById("device-status-dot");
  const text = document.getElementById("device-status-text");
  if (isOnline) {
    dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
    text.className = "font-semibold text-emerald-400";
    text.innerText = "Online";
  } else {
    dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
    text.className = "font-semibold text-rose-400";
    text.innerText = "Offline";
  }
}

// Freshness Timer
setInterval(() => {
  const textElem = document.getElementById("freshness-text");
  if (!systemState.lastTelemetryTime) {
    textElem.innerText = "Chưa có tin";
    return;
  }
  const sec = Math.floor((Date.now() - systemState.lastTelemetryTime) / 1000);
  textElem.innerText = sec < 60 ? `${sec}s trước` : `${Math.floor(sec / 60)}p trước`;
  textElem.className = sec > 15 ? "font-mono text-rose-400 font-medium" : "font-mono text-emerald-400 font-medium";
}, 1000);

function logToConsole(text) {
  const box = document.getElementById("console-log-box");
  const p = document.createElement("p");
  const time = new Date().toLocaleTimeString("vi-VN", { hour12: false });
  p.innerText = `[${time}] ${text}`;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

function clearConsoleLog() {
  document.getElementById("console-log-box").innerHTML = "";
}

function toggleConfigModal() {
  document.getElementById("config-modal").classList.toggle("hidden");
}

function saveAndReconnectMQTT() {
  mqttConfig.host = document.getElementById("cfg-host").value.trim();
  mqttConfig.port = Number(document.getElementById("cfg-port").value.trim());
  mqttConfig.topicTelemetry = document.getElementById("cfg-topic").value.trim();
  toggleConfigModal();
  if (mqttClient && mqttClient.isConnected()) mqttClient.disconnect();
  connectMQTT();
}

// ==========================================
// 7. CHẾ ĐỘ MÔ PHỎNG 2 PHÒNG RIÊNG BIỆT
// ==========================================
function toggleSimulation() {
  const btn = document.getElementById("btn-simulation");
  isSimulating = !isSimulating;

  if (isSimulating) {
    btn.innerText = "Dừng Mô Phỏng 2 Phòng";
    btn.className = "px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition flex items-center gap-1.5";
    logToConsole("[Simulation] Đã bật mô phỏng dữ liệu 2 phòng độc lập (2s/lần)");
    setDeviceOnlineStatus(true);

    simulationTimer = setInterval(() => {
      // Giả lập Phòng Khách (nhiệt độ ban ngày cao hơn, ánh sáng sáng hơn)
      const r1Temp = 29.2 + (Math.random() * 3 - 1.5);
      const r1Humid = 66 + (Math.random() * 8 - 4);
      const r1Lux = Math.floor(400 + Math.random() * 500);
      const r1Motion = Math.random() > 0.5 ? 1 : 0;

      // Giả lập Phòng Ngủ (mát hơn, dịu ánh sáng hơn)
      const r2Temp = 27.0 + (Math.random() * 2 - 1);
      const r2Humid = 62 + (Math.random() * 6 - 3);
      const r2Lux = Math.floor(80 + Math.random() * 200);
      const r2Motion = Math.random() > 0.75 ? 1 : 0;

      const mockData = {
        device_id: "ESP32_2ROOMS_NODE",
        timestamp: Date.now() - Math.floor(Math.random() * 35 + 10),
        room1: {
          temperature: parseFloat(r1Temp.toFixed(1)),
          humidity: parseFloat(r1Humid.toFixed(1)),
          lux: r1Lux,
          motion: r1Motion,
          fan_state: systemState.rooms[1].fanState ? "ON" : "OFF",
          fan_pwm: systemState.rooms[1].fanPwm,
          led_state: systemState.rooms[1].ledState ? "ON" : "OFF",
          led_pwm: systemState.rooms[1].ledPwm,
          mode: systemState.rooms[1].mode
        },
        room2: {
          temperature: parseFloat(r2Temp.toFixed(1)),
          humidity: parseFloat(r2Humid.toFixed(1)),
          lux: r2Lux,
          motion: r2Motion,
          fan_state: systemState.rooms[2].fanState ? "ON" : "OFF",
          fan_pwm: systemState.rooms[2].fanPwm,
          led_state: systemState.rooms[2].ledState ? "ON" : "OFF",
          led_pwm: systemState.rooms[2].ledPwm,
          mode: systemState.rooms[2].mode
        }
      };

      process2RoomsTelemetry(mockData);
    }, 2000);
  } else {
    btn.innerText = "Test UI (Mô phỏng 2 Phòng)";
    btn.className = "px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30";
    clearInterval(simulationTimer);
    logToConsole("[Simulation] Đã dừng mô phỏng.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initChart();
  connectMQTT();
});
