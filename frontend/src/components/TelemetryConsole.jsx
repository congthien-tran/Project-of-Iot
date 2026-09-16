import React from 'react';
import { Terminal } from 'lucide-react';

export const TelemetryConsole = ({ telemetryLatency, commandLatency, logs, onClearLogs, onSendPing }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
        <div>
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Đo Đạc Độ Trễ (Tuần 3 Thực Nghiệm)
          </h4>
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-slate-400 font-medium">Telemetry Latency:</p>
                <p className="text-[10px] text-slate-500">(ESP32 &rarr; Server &rarr; Web)</p>
              </div>
              <span className="text-base font-mono font-bold text-emerald-400">
                {telemetryLatency !== null ? `${telemetryLatency} ms` : '-- ms'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-slate-400 font-medium">Command Response:</p>
                <p className="text-[10px] text-slate-500">(Web &rarr; Server &rarr; Chấp hành)</p>
              </div>
              <span className="text-base font-mono font-bold text-sky-400">
                {commandLatency !== null ? `${commandLatency} ms` : '-- ms'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onSendPing}
          className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
        >
          Gửi Test Ping Đo Độ Trễ
        </button>
      </div>

      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Nhật Ký Gói Tin Socket.io (Event Console)
          </h4>
          <button onClick={onClearLogs} className="text-xs text-slate-500 hover:text-slate-300 transition">
            Xóa log
          </button>
        </div>
        <div className="flex-1 min-h-[120px] max-h-[140px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-400 space-y-1">
          {logs.map((log, index) => (
            <p key={index} className="leading-relaxed">{log}</p>
          ))}
        </div>
      </div>
    </div>
  );
};