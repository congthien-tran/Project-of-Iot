import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Activity } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Định nghĩa nét đứt cho biểu đồ ngoài trời
const DASH_STYLE = Array.of(5, 4);

export const RealtimeChart = ({ history }) => {
  const [metric, setMetric] = useState('temp');

  const chartConfig = useMemo(() => {
    const labels = history?.labels || [];
    let datasets = [];
    let yCallback = (val) => val;
    let metricLabel = '';
    let metricClass = '';
    let avgIndoor = '--';
    let avgOutdoor = '--';

    const getAvg = (arr) => (arr && arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--');

    if (metric === 'temp') {
      metricLabel = 'Nhiệt Độ (°C)';
      metricClass = 'text-orange-400';
      avgIndoor = `${getAvg(history?.indoor?.temp)} °C`;
      avgOutdoor = `${getAvg(history?.outdoor?.temp)} °C`;
      yCallback = (val) => `${val}°C`;
      datasets = [
        {
          label: 'Nhiệt độ Trong Nhà (Indoor)',
          data: history?.indoor?.temp || [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: 'Nhiệt độ Ngoài Trời (Outdoor)',
          data: history?.outdoor?.temp || [],
          borderColor: '#f97316',
          borderDash: DASH_STYLE,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }
      ];
    } else if (metric === 'humid') {
      metricLabel = 'Độ Ẩm (%RH)';
      metricClass = 'text-cyan-400';
      avgIndoor = `${Math.round(getAvg(history?.indoor?.humid) || 0)} %`;
      avgOutdoor = `${Math.round(getAvg(history?.outdoor?.humid) || 0)} %`;
      yCallback = (val) => `${val}%`;
      datasets = [
        {
          label: 'Độ ẩm Trong Nhà (Indoor)',
          data: history?.indoor?.humid || [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: 'Độ ẩm Ngoài Trời (Outdoor)',
          data: history?.outdoor?.humid || [],
          borderColor: '#38bdf8',
          borderDash: DASH_STYLE,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }
      ];
    } else if (metric === 'lux') {
      metricLabel = 'Ánh Sáng (Lux)';
      metricClass = 'text-yellow-400';
      avgIndoor = `${Math.round(getAvg(history?.indoor?.lux) || 0)} Lux`;
      avgOutdoor = `${Math.round(getAvg(history?.outdoor?.lux) || 0)} Lux`;
      yCallback = (val) => `${val} Lux`;
      datasets = [
        {
          label: 'Ánh sáng Trong Nhà (Indoor)',
          data: history?.indoor?.lux || [],
          borderColor: '#eab308',
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          fill: true,
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: 'Ánh sáng Ngoài Trời (Outdoor)',
          data: history?.outdoor?.lux || [],
          borderColor: '#fde047',
          borderDash: DASH_STYLE,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }
      ];
    } else if (metric === 'pir') {
      metricLabel = 'Hiện Diện PIR Trong Nhà';
      metricClass = 'text-emerald-400';
      const count = history?.indoor?.pir ? history.indoor.pir.filter((v) => v === 1).length : 0;
      avgIndoor = `${count} lần có người`;
      avgOutdoor = 'Chỉ lắp trong nhà';
      yCallback = (val) => (val === 1 ? 'Có người' : 'Trống');
      datasets = [
        {
          label: 'Hiện diện Trong Nhà (1: Có người, 0: Trống)',
          data: history?.indoor?.pir || [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          borderWidth: 2.5,
          stepped: 'before',
          pointRadius: 0
        }
      ];
    }

    return {
      metricLabel,
      metricClass,
      avgIndoor,
      avgOutdoor,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { family: 'Inter', size: 12, weight: '600' }, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#94a3b8',
            bodyColor: '#f8fafc',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.25)' },
            ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 12 }
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: yCallback,
              stepSize: metric === 'pir' ? 1 : undefined
            }
          }
        }
      }
    };
  }, [metric, history]);

  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              BIỂU ĐỒ CẢM BIẾN MÔI TRƯỜNG THỜI GIAN THỰC
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            So sánh vi khí hậu giữa <span className="text-indigo-400 font-medium">Trong Nhà (Đường liền)</span> và <span className="text-amber-400 font-medium">Ngoài Trời (Đường đứt nét)</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
          {[
            { key: 'temp', label: 'Nhiệt độ', icon: '🌡️', active: 'bg-orange-500 border-orange-400' },
            { key: 'humid', label: 'Độ ẩm', icon: '💧', active: 'bg-cyan-500 border-cyan-400' },
            { key: 'lux', label: 'Ánh sáng', icon: '☀️', active: 'bg-yellow-500 border-yellow-400' },
            { key: 'pir', label: 'Hiện diện', icon: '🚶', active: 'bg-emerald-500 border-emerald-400' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setMetric(item.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                metric === item.key
                  ? `${item.active} text-white shadow-lg`
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs font-mono">
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px]">Chỉ số đang xem:</span>
          <span className={`${chartConfig.metricClass} font-bold text-sm`}>{chartConfig.metricLabel}</span>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px]">Khung thời gian:</span>
          <span className="text-slate-200 font-semibold text-sm">1 Giờ (60 mẫu)</span>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-indigo-400 text-[11px]">Trong Nhà (TB 1h):</span>
          <span className="text-indigo-300 font-bold text-sm">{chartConfig.avgIndoor}</span>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-amber-400 text-[11px]">Ngoài Trời (TB 1h):</span>
          <span className="text-amber-300 font-bold text-sm">{chartConfig.avgOutdoor}</span>
        </div>
      </div>

      <div className="h-72 sm:h-80 w-full relative">
        <Line data={chartConfig.data} options={chartConfig.options} />
      </div>
    </section>
  );
};