import React, { useState, useEffect, useRef } from 'react';
import { Sliders } from 'lucide-react';

export const ActuatorControls = ({ mode, actuators, onSendCommand }) => {
  const PWM_MAX = 4095;

  const [fanPwm, setFanPwm] = useState(actuators.fanPwm ?? 0);
  const [ledPwm, setLedPwm] = useState(actuators.ledPwm ?? 0);
  const [deskLedOn, setDeskLedOn] = useState(actuators.ledDeskState === 'ON');

  // Cờ nhận diện người dùng đang chạm/kéo thanh trượt (tránh bị server giật ngược lại)
  const isDraggingFanRef = useRef(false);
  const isDraggingLedRef = useRef(false);

  // Bộ đếm thời gian điều tiết (Throttle ~60ms) khi kéo
  const lastFanSendTimeRef = useRef(0);
  const fanTimerRef = useRef(null);

  const lastLedSendTimeRef = useRef(0);
  const ledTimerRef = useRef(null);

  // Đồng bộ với server khi người dùng KHÔNG chạm vào thanh trượt
  useEffect(() => {
    if (!isDraggingFanRef.current) {
      setFanPwm(actuators.fanPwm ?? 0);
    }
  }, [actuators.fanPwm]);

  useEffect(() => {
    if (!isDraggingLedRef.current) {
      setLedPwm(actuators.ledPwm ?? 0);
    }
  }, [actuators.ledPwm]);

  useEffect(() => {
    setDeskLedOn(actuators.ledDeskState === 'ON');
  }, [actuators.ledDeskState]);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (fanTimerRef.current) clearTimeout(fanTimerRef.current);
      if (ledTimerRef.current) clearTimeout(ledTimerRef.current);
    };
  }, []);

  const isFanOn = actuators.fanState === 'ON' && fanPwm > 0;
  const isLedOn = actuators.ledState === 'ON' && ledPwm > 0;

  // ==========================================================
  // XỬ LÝ KÉO THANH TRƯỢT QUẠT (KÉO ĐẾN ĐÂU CẬP NHẬT ĐẾN ĐÓ)
  // ==========================================================
  const handleFanSliderDrag = (val) => {
    const pwm = Number(val);
    setFanPwm(pwm); // Cập nhật số trên màn hình 60fps tức thì

    const now = Date.now();
    // Bắn lệnh liên tục mỗi 60ms khi đang di chuyển thanh trượt
    if (now - lastFanSendTimeRef.current > 60) {
      lastFanSendTimeRef.current = now;
      onSendCommand({
        actuator: 'fan',
        state: pwm > 0 ? 'ON' : 'OFF',
        pwm: pwm,
        mode: mode === 'AUTO' ? 'MANUAL' : mode
      });
    } else {
      // Đảm bảo giá trị cuối cùng khi dừng lại luôn được gửi
      if (fanTimerRef.current) clearTimeout(fanTimerRef.current);
      fanTimerRef.current = setTimeout(() => {
        onSendCommand({
          actuator: 'fan',
          state: pwm > 0 ? 'ON' : 'OFF',
          pwm: pwm,
          mode: mode === 'AUTO' ? 'MANUAL' : mode
        });
      }, 60);
    }
  };

  const handleToggleFan = () => {
    const nextState = isFanOn ? 'OFF' : 'ON';
    const nextPwm = isFanOn ? 0 : PWM_MAX;
    setFanPwm(nextPwm);
    onSendCommand({
      actuator: 'fan',
      state: nextState,
      pwm: nextPwm,
      mode: mode === 'AUTO' ? 'MANUAL' : mode
    });
  };

  // ==========================================================
  // XỬ LÝ KÉO THANH TRƯỢT ĐÈN TRẦN (KÉO ĐẾN ĐÂU CẬP NHẬT ĐẾN ĐÓ)
  // ==========================================================
  const handleLedSliderDrag = (val) => {
    const pwm = Number(val);
    setLedPwm(pwm); // Cập nhật số trên màn hình 60fps tức thì

    const now = Date.now();
    if (now - lastLedSendTimeRef.current > 60) {
      lastLedSendTimeRef.current = now;
      onSendCommand({
        actuator: 'led_indoor',
        state: pwm > 0 ? 'ON' : 'OFF',
        pwm: pwm,
        mode: mode === 'AUTO' ? 'MANUAL' : mode
      });
    } else {
      if (ledTimerRef.current) clearTimeout(ledTimerRef.current);
      ledTimerRef.current = setTimeout(() => {
        onSendCommand({
          actuator: 'led_indoor',
          state: pwm > 0 ? 'ON' : 'OFF',
          pwm: pwm,
          mode: mode === 'AUTO' ? 'MANUAL' : mode
        });
      }, 60);
    }
  };

  const handleToggleLed = () => {
    const nextState = isLedOn ? 'OFF' : 'ON';
    const nextPwm = isLedOn ? 0 : PWM_MAX;
    setLedPwm(nextPwm);
    onSendCommand({
      actuator: 'led_indoor',
      state: nextState,
      pwm: nextPwm,
      mode: mode === 'AUTO' ? 'MANUAL' : mode
    });
  };

  // ==========================================================
  // ĐÈN BÀN HỌC (ON / OFF)
  // ==========================================================
  const handleToggleDeskLed = () => {
    const nextState = deskLedOn ? 'OFF' : 'ON';
    setDeskLedOn(!deskLedOn);
    onSendCommand({
      actuator: 'led_desk',
      state: nextState,
      mode: mode === 'AUTO' ? 'MANUAL' : mode
    });
  };

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 mb-5 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              BẢNG ĐIỀU KHIỂN THIẾT BỊ TRONG PHÒNG
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                12-Bit PWM & Đèn Bàn
              </span>
            </h2>
            <p className="text-xs text-slate-400">1 Quạt DC + 1 Đèn Trần Bù Sáng (0 - 4095) + 1 Đèn Bàn Học (GPIO 32)</p>
          </div>
        </div>

        {/* Chế độ Auto / Manual */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 px-2 shrink-0">Chế độ vận hành:</span>
          <div className="relative flex items-center w-64 bg-slate-900 p-1 rounded-xl border border-slate-800/80">
            <div
              className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-in-out shadow-md ${
                mode === 'AUTO' ? 'bg-indigo-600 translate-x-0' : 'bg-amber-600 translate-x-full'
              }`}
            />
            <button
              onClick={() => onSendCommand({ mode: 'AUTO' })}
              className={`relative z-10 flex-1 py-1.5 text-xs font-semibold text-center transition-colors ${
                mode === 'AUTO' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Auto (Tự Động)
            </button>
            <button
              onClick={() => onSendCommand({ mode: 'MANUAL' })}
              className={`relative z-10 flex-1 py-1.5 text-xs font-semibold text-center transition-colors ${
                mode === 'MANUAL' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Manual (Thủ Công)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Thiết bị 1: Quạt DC */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-inner flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-sky-500/10 text-sky-400 rounded-lg text-base">🌀</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Quạt DC Thông Gió</h3>
                  <p className="text-[11px] text-slate-400">Điều chỉnh tốc độ 12-bit PWM</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                  isFanOn ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isFanOn ? `ON (${Math.round((fanPwm / PWM_MAX) * 100)}%)` : 'OFF (0%)'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                onClick={handleToggleFan}
                className={`py-2 px-4 rounded-xl text-xs font-semibold transition shadow-sm ${
                  isFanOn ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {isFanOn ? 'TẮT QUẠT' : 'BẬT QUẠT'}
              </button>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 mr-1">PWM:</span>
                <span className="text-base font-mono font-bold text-sky-400">{fanPwm} / 4095</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5">Kéo chỉnh tốc độ (cập nhật trực tiếp):</label>
            <input
              type="range"
              min="0"
              max={PWM_MAX}
              value={fanPwm}
              onMouseDown={() => { isDraggingFanRef.current = true; }}
              onTouchStart={() => { isDraggingFanRef.current = true; }}
              onChange={(e) => handleFanSliderDrag(e.target.value)}
              onMouseUp={() => { setTimeout(() => { isDraggingFanRef.current = false; }, 300); }}
              onTouchEnd={() => { setTimeout(() => { isDraggingFanRef.current = false; }, 300); }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>
        </div>

        {/* Thiết bị 2: Đèn Trần Chiếu Sáng */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-inner flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg text-base">💡</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Đèn Trần Bù Sáng</h3>
                  <p className="text-[11px] text-slate-400">Tự động thích ứng ánh sáng</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                  isLedOn ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isLedOn ? `ON (${Math.round((ledPwm / PWM_MAX) * 100)}%)` : 'OFF (0%)'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                onClick={handleToggleLed}
                className={`py-2 px-4 rounded-xl text-xs font-semibold transition shadow-sm ${
                  isLedOn ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {isLedOn ? 'TẮT ĐÈN' : 'BẬT ĐÈN'}
              </button>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 mr-1">PWM:</span>
                <span className="text-base font-mono font-bold text-amber-400">{ledPwm} / 4095</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5">Kéo chỉnh độ sáng (cập nhật trực tiếp):</label>
            <input
              type="range"
              min="0"
              max={PWM_MAX}
              value={ledPwm}
              onMouseDown={() => { isDraggingLedRef.current = true; }}
              onTouchStart={() => { isDraggingLedRef.current = true; }}
              onChange={(e) => handleLedSliderDrag(e.target.value)}
              onMouseUp={() => { setTimeout(() => { isDraggingLedRef.current = false; }, 300); }}
              onTouchEnd={() => { setTimeout(() => { isDraggingLedRef.current = false; }, 300); }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>

        {/* Thiết bị 3: Đèn Bàn Học (LED Desk) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-inner flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg text-base">📖</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Đèn Bàn Học (LED Desk)</h3>
                  <p className="text-[11px] text-slate-400">Giữ sáng 30s khi ngồi yên</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                  deskLedOn ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {deskLedOn ? 'ON (BẬT)' : 'OFF (TẮT)'}
              </span>
            </div>

            <div className="my-3">
              <button
                onClick={handleToggleDeskLed}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition shadow-sm flex items-center justify-center gap-2 ${
                  deskLedOn
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                <span>{deskLedOn ? 'TẮT ĐÈN BÀN' : 'BẬT ĐÈN BÀN'}</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 text-center border-t border-slate-800/60 pt-2">
            GPIO 32 (MOSFET) • Bật / Tắt trực tiếp
          </div>
        </div>
      </div>
    </section>
  );
};
