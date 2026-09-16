import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../services/socket';
import { getTelemetryHistory, sendControlCommand } from '../services/api';

const MAX_POINTS = 60;

export const useTelemetry = () => {
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [isEspOnline, setIsEspOnline] = useState(false);
  const [isInternetOnline, setIsInternetOnline] = useState(navigator.onLine);
  const [lastTelemetryTime, setLastTelemetryTime] = useState(null);
  const [telemetryLatency, setTelemetryLatency] = useState(null);
  const [commandLatency, setCommandLatency] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [state, setState] = useState({
    mode: 'AUTO',
    indoor: { temp: 28.4, humid: 65, heatIndex: 30.6, lux: 420, motion: 0 },
    outdoor: { temp: 32.6, humid: 58, heatIndex: 37.1, lux: 1200 },
    actuators: { fanState: 'OFF', fanPwm: 0, ledState: 'OFF', ledPwm: 0, ledDeskState: 'OFF' }
  });

  const [history, setHistory] = useState({
    labels: [],
    indoor: { temp: [], humid: [], lux: [], pir: [] },
    outdoor: { temp: [], humid: [], lux: [] }
  });

  const [logs, setLogs] = useState([
    `[${new Date().toLocaleTimeString('vi-VN')}] [System] Khởi động giao diện giám sát vi khí hậu...`
  ]);

  const lastCommandTimeRef = useRef(0);

  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 99)]);
  }, []);

  const calculateHeatIndex = (T, RH) => {
    const numT = Number(T);
    const numRH = Number(RH);
    if (!numT || !numRH || isNaN(numT) || isNaN(numRH)) return 0;
    return Number((numT + 0.33 * (numRH / 100 * 6.105 * Math.exp(17.27 * numT / (237.7 + numT))) - 4.0).toFixed(1));
  };

  const processIncomingData = useCallback((record) => {
    if (!record) return;
    const now = Date.now();
    setLastTelemetryTime(now);
    setIsEspOnline(true);

    if (record.timestamp) {
      const packetTime = new Date(record.timestamp).getTime();
      if (!isNaN(packetTime) && packetTime > 1000000000000) {
        setTelemetryLatency(Math.max(0, now - packetTime));
      } else {
        setTelemetryLatency(35);
      }
    }

    const ind = record.indoor || {};
    const out = record.outdoor || {};

    const inTemp = Number(ind.temperature ?? ind.temp ?? 0);
    const inHumid = Number(ind.humidity ?? ind.humid ?? 0);
    const inHeat = Number(ind.heatIndex ?? ind.heat_index ?? calculateHeatIndex(inTemp, inHumid));
    const inLux = Math.round(Number(ind.lux ?? 0));
    const inMotion = (ind.motion === 1 || ind.motion === true || ind.motion === '1') ? 1 : 0;

    const outTemp = Number(out.temperature ?? out.temp ?? 0);
    const outHumid = Number(out.humidity ?? out.humid ?? 0);
    const outHeat = Number(out.heatIndex ?? out.heat_index ?? calculateHeatIndex(outTemp, outHumid));
    const outLux = Math.round(Number(out.lux ?? 0));

    const fanState = record.actuators?.fanState || record.fan_state || 'OFF';
    const fanPwm = Number(record.actuators?.fanPwm ?? record.fan_pwm ?? 0);
    const ledState = record.actuators?.ledState || record.led_state || 'OFF';
    const ledPwm = Number(record.actuators?.ledPwm ?? record.led_pwm ?? 0);
    const ledDeskState = record.actuators?.ledDeskState || record.led_desk_state || record.led_desk || 'OFF';
    const mode = String(record.mode || 'AUTO').toUpperCase();

    setState({
      mode,
      indoor: { temp: inTemp, humid: inHumid, heatIndex: inHeat, lux: inLux, motion: inMotion },
      outdoor: { temp: outTemp, humid: outHumid, heatIndex: outHeat, lux: outLux },
      actuators: { fanState, fanPwm, ledState, ledPwm, ledDeskState }
    });

    const timeLabel = new Date(record.timestamp || now).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    setHistory((prev) => ({
      labels: [...prev.labels, timeLabel].slice(-MAX_POINTS),
      indoor: {
        temp: [...prev.indoor.temp, inTemp].slice(-MAX_POINTS),
        humid: [...prev.indoor.humid, inHumid].slice(-MAX_POINTS),
        lux: [...prev.indoor.lux, inLux].slice(-MAX_POINTS),
        pir: [...prev.indoor.pir, inMotion].slice(-MAX_POINTS)
      },
      outdoor: {
        temp: [...prev.outdoor.temp, outTemp].slice(-MAX_POINTS),
        humid: [...prev.outdoor.humid, outHumid].slice(-MAX_POINTS),
        lux: [...prev.outdoor.lux, outLux].slice(-MAX_POINTS)
      }
    }));

    addLog(`[Live Data] Trong: ${inTemp}°C, ${inHumid}% | Đèn Bàn: ${ledDeskState}`);

    if (lastCommandTimeRef.current > 0) {
      setCommandLatency(now - lastCommandTimeRef.current);
      lastCommandTimeRef.current = 0;
    }
  }, [addLog]);

  // 1. Tải bản ghi ban đầu từ MongoDB
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await getTelemetryHistory(MAX_POINTS);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const labels = [];
          const inTemp = [], inHumid = [], inLux = [], inPir = [];
          const outTemp = [], outHumid = [], outLux = [];

          res.data.forEach((item) => {
            const label = new Date(item.timestamp).toLocaleTimeString('vi-VN', {
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            labels.push(label);
            inTemp.push(Number(item.indoor?.temperature ?? 0));
            inHumid.push(Number(item.indoor?.humidity ?? 0));
            inLux.push(Math.round(Number(item.indoor?.lux ?? 0)));
            inPir.push(item.indoor?.motion === 1 ? 1 : 0);

            outTemp.push(Number(item.outdoor?.temperature ?? 0));
            outHumid.push(Number(item.outdoor?.humidity ?? 0));
            outLux.push(Math.round(Number(item.outdoor?.lux ?? 0)));
          });

          setHistory({
            labels,
            indoor: { temp: inTemp, humid: inHumid, lux: inLux, pir: inPir },
            outdoor: { temp: outTemp, humid: outHumid, lux: outLux }
          });

          processIncomingData(res.data[res.data.length - 1]);
          addLog(`[REST API] Đã tải dữ liệu lịch sử từ MongoDB.`);
        }
      } catch (err) {
        addLog(`[Lỗi REST API] ${err.message}`);
      }
    };

    fetchHistory();
  }, [addLog, processIncomingData]);

  // 2. Lắng nghe Socket.io
  useEffect(() => {
    const handleConnect = () => {
      setIsSocketConnected(true);
      addLog(`[Socket.io] Đã kết nối với Node.js Backend Server! (ID: ${socket.id})`);
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
      setIsEspOnline(false);
      addLog(`[Socket.io] Mất kết nối tới Server.`);
    };

    const handleTelemetry = (data) => processIncomingData(data);

    if (socket.connected) handleConnect();

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('telemetry_update', handleTelemetry);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('telemetry_update', handleTelemetry);
    };
  }, [processIncomingData, addLog]);

  // 3. Watchdog kiểm tra Offline
  useEffect(() => {
    const checkAliveTimer = setInterval(() => {
      if (lastTelemetryTime && Date.now() - lastTelemetryTime > 10000) {
        setIsEspOnline(false);
      }
    }, 3000);

    return () => clearInterval(checkAliveTimer);
  }, [lastTelemetryTime]);

  // 4. Gửi lệnh điều khiển xuống Backend / ESP32 (Phản hồi tức thì 0ms)
  const sendCommand = async (payload) => {
    lastCommandTimeRef.current = Date.now();
    addLog(`[Control Command] Gửi: ${JSON.stringify(payload)}`);

    // CẬP NHẬT GIAO DIỆN NGAY LẬP TỨC (OPTIMISTIC UPDATE)
    setState((prev) => {
      const nextActuators = { ...prev.actuators };

      if (payload.actuator === 'fan') {
        if (payload.state !== undefined) nextActuators.fanState = payload.state;
        if (payload.pwm !== undefined) nextActuators.fanPwm = payload.pwm;
      }

      if (payload.actuator === 'led' || payload.actuator === 'led_in' || payload.actuator === 'led_indoor') {
        if (payload.state !== undefined) nextActuators.ledState = payload.state;
        if (payload.pwm !== undefined) nextActuators.ledPwm = payload.pwm;
      }

      if (payload.actuator === 'led_desk') {
        if (payload.state !== undefined) nextActuators.ledDeskState = payload.state;
      }

      return {
        ...prev,
        mode: payload.mode ? String(payload.mode).toUpperCase() : prev.mode,
        actuators: nextActuators
      };
    });

    if (isSimulating) {
      setCommandLatency(25);
      return;
    }

    try {
      await sendControlCommand(payload);
    } catch (err) {
      addLog(`[Lỗi Gửi Lệnh] ${err.response?.data?.error || err.message}`);
    }
  };

  const toggleSimulation = () => setIsSimulating((prev) => !prev);

  return {
    state,
    history,
    logs,
    clearLogs: () => setLogs([]),
    isSocketConnected,
    isEspOnline,
    isInternetOnline,
    lastTelemetryTime,
    telemetryLatency,
    commandLatency,
    sendCommand,
    isSimulating,
    toggleSimulation
  };
};
