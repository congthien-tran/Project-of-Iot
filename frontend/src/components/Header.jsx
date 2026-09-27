import React, { useState, useEffect } from 'react';
import { Home, Clock, Play, Square } from 'lucide-react';

export const Header = ({
  versionLabel,
  isInternetOnline,
  isEspOnline,
  lastTelemetryTime,
  isSimulating,
  onToggleSimulation
}) => {
  const [freshness, setFreshness] = useState('Chưa có tin');

  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastTelemetryTime) {
        setFreshness('Chưa có tin');
        return;
      }
      const sec = Math.floor((Date.now() - lastTelemetryTime) / 1000);
      setFreshness(sec < 60 ? `${sec}s trước` : `${Math.floor(sec / 60)}p trước`);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastTelemetryTime]);

  return (
    <header className="max-w-7xl mx-auto mb-6 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col items-center justify-center gap-4 text-center">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
        <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-sky-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner shrink-0">
          <Home className="w-7 h-7" />
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight text-white">
              HỆ THỐNG GIÁM SÁT MÔI TRƯỜNG & ĐIỀU HÒA VI KHÍ HẬU
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              {versionLabel || '1 Phòng: Trong Nhà & Ngoài Trời'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            2 Cảm biến Nhiệt Ẩm • 2 Cảm biến Ánh Sáng • 1 Hiện Diện PIR (Trong Nhà) | Nhóm ĐTV-02
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm p-2 bg-slate-950/60 rounded-2xl border border-slate-800/80 w-full sm:w-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${isInternetOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-slate-400 text-xs">Internet:</span>
          <span className={`font-semibold text-xs ${isInternetOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isInternetOnline ? 'Đã kết nối' : 'Mất kết nối'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${isEspOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-slate-400 text-xs">ESP32:</span>
          <span className={`font-semibold text-xs ${isEspOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isEspOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 text-xs">Cập nhật:</span>
          <span className="font-mono text-amber-400 font-medium text-xs">{freshness}</span>
        </div>

        <button
          onClick={onToggleSimulation}
          className={`px-3.5 py-1.5 font-medium rounded-xl transition flex items-center gap-1.5 text-xs shadow-lg ${
            isSimulating ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
        >
          {isSimulating ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isSimulating ? 'Dừng Mô Phỏng' : 'Test UI (Mô phỏng Dữ liệu)'}</span>
        </button>
      </div>
    </header>
  );
};