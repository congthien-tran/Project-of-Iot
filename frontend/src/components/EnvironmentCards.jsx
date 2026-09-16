import React from 'react';
import { Home, Sun, Scale } from 'lucide-react';

export const EnvironmentCards = ({ indoor = {}, outdoor = {} }) => {
  const inTemp = Number(indoor.temp ?? 0);
  const outTemp = Number(outdoor.temp ?? 0);
  const inHumid = Number(indoor.humidity ?? indoor.humid ?? 0);
  const outHumid = Number(outdoor.humidity ?? outdoor.humid ?? 0);
  const inLux = Number(indoor.lux ?? 0);
  const outLux = Number(outdoor.lux ?? 0);

  const dTemp = (inTemp - outTemp).toFixed(1);
  const dHumid = Math.round(inHumid - outHumid);
  const dLux = inLux - outLux;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Trong nhà */}
      <section className="bg-slate-900/90 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                TRONG NHÀ (INDOOR)
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Inside</span>
              </h2>
              <p className="text-xs text-slate-400">1 DHT22 • 1 BH1750 • 1 PIR Hiện diện</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-950 border border-indigo-800 text-indigo-300">Vi khí hậu phòng</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-slate-400 mb-2">
                <span className="text-xs font-medium">Nhiệt ẩm Trong</span>
                <span className="p-1 bg-orange-500/10 text-orange-400 rounded text-sm">🌡️</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{inTemp.toFixed(1)}</span>
                <span className="text-xs text-slate-400">°C</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs text-slate-400">Độ ẩm:</span>
                <span className="text-lg font-bold font-mono text-cyan-400">{Math.round(inHumid)}</span>
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 flex justify-between">
              <span>Heat Index:</span>
              <span className="font-mono text-orange-400 font-semibold">{Number(indoor.heatIndex ?? 0).toFixed(1)} °C</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-slate-400 mb-2">
                <span className="text-xs font-medium">Ánh sáng Trong</span>
                <span className="p-1 bg-yellow-500/10 text-yellow-400 rounded text-sm">💡</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{inLux}</span>
                <span className="text-xs text-slate-400">Lux</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Độ rọi mặt bàn</p>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 flex justify-between">
              <span>Đánh giá:</span>
              <span className={inLux < 150 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
                {inLux < 150 ? 'Tối (Bật đèn)' : 'Đủ sáng'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-slate-400 mb-2">
                <span className="text-xs font-medium">Hiện diện PIR</span>
                <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded text-sm">🚶</span>
              </div>
              <div className="my-2">
                <span className={`block text-center py-2 px-2 rounded-xl text-xs font-semibold ${
                  indoor.motion === 1
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {indoor.motion === 1 ? 'PHÁT HIỆN CÓ NGƯỜI' : 'Không có người'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 text-center border-t border-slate-800/60 pt-1.5">
              Cảm biến hồng ngoại thụ động
            </div>
          </div>
        </div>
      </section>

      {/* Ngoài trời */}
      <section className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                NGOÀI TRỜI (OUTDOOR)
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Outside</span>
              </h2>
              <p className="text-xs text-slate-400">1 DHT22 • 1 BH1750 (Tham chiếu môi trường)</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-amber-950 border border-amber-800 text-amber-300">Khí tượng tự nhiên</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-slate-400 mb-2">
                <span className="text-xs font-medium">Nhiệt ẩm Ngoài</span>
                <span className="p-1 bg-orange-500/10 text-orange-400 rounded text-sm">☀️</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{outTemp.toFixed(1)}</span>
                <span className="text-xs text-slate-400">°C</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs text-slate-400">Độ ẩm:</span>
                <span className="text-lg font-bold font-mono text-cyan-400">{Math.round(outHumid)}</span>
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 flex justify-between">
              <span>Heat Index:</span>
              <span className="font-mono text-orange-400 font-semibold">{Number(outdoor.heatIndex ?? 0).toFixed(1)} °C</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-slate-400 mb-2">
                <span className="text-xs font-medium">Ánh sáng Ngoài</span>
                <span className="p-1 bg-yellow-500/10 text-yellow-400 rounded text-sm">☀️</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{outLux}</span>
                <span className="text-xs text-slate-400">Lux</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Cường độ nắng/trời</p>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 flex justify-between">
              <span>Thời điểm:</span>
              <span className={outLux > 500 ? 'text-amber-400 font-medium' : 'text-indigo-400 font-medium'}>
                {outLux > 500 ? 'Nắng / Ban ngày' : 'Trời tối / Ban đêm'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-slate-400 mb-2">
                <span className="text-xs font-medium">Chênh Lệch (Δ)</span>
                <Scale className="w-4 h-4 text-purple-400" />
              </div>
              <div className="space-y-1.5 mt-1 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Δ Nhiệt độ:</span>
                  <span className="text-emerald-400 font-bold">{dTemp > 0 ? `+${dTemp}` : dTemp} °C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Δ Độ ẩm:</span>
                  <span className="text-cyan-400 font-bold">{dHumid > 0 ? `+${dHumid}` : dHumid} %</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Δ Ánh sáng:</span>
                  <span className="text-yellow-400 font-bold">{dLux > 0 ? `+${dLux}` : dLux} Lux</span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 text-center border-t border-slate-800/60 pt-1.5">
              Đánh giá cách nhiệt & chiếu sáng
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};