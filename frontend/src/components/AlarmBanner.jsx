import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const AlarmBanner = ({ indoor, outdoor }) => {
  const alarms = [];
  if (indoor.temp > 35 || indoor.heatIndex > 38) alarms.push('Trong nhà quá nóng (Heat Index cao)');
  if (indoor.humid > 85) alarms.push('Trong nhà nồm ẩm (>85%)');
  if (outdoor.temp > 38) alarms.push('Ngoài trời nắng gắt (>38°C)');

  if (alarms.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto mb-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-300 flex items-center justify-between animate-pulse shadow-lg">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
        <span className="font-medium text-xs sm:text-sm">
          Cảnh báo: {alarms.join(' | ')}
        </span>
      </div>
      <span className="text-xs bg-rose-500/20 px-2.5 py-1 rounded-lg font-bold text-rose-300 border border-rose-500/30">
        CẦN XỬ LÝ
      </span>
    </div>
  );
};