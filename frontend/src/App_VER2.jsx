import React, { useState } from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import { Header } from './components/Header';
import { AlarmBanner } from './components/AlarmBanner';
import { EnvironmentCards } from './components/EnvironmentCards';
import { ActuatorControls } from './components/ActuatorControls';
import { RealtimeChart } from './components/RealtimeChart';
import { TelemetryConsole } from './components/TelemetryConsole';
import { Sliders, Activity } from 'lucide-react';

export default function App_VER2() {
  const telemetry = useTelemetry();
  const [activeTab, setActiveTab] = useState('control'); // 'control' hoặc 'chart'

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen p-3 sm:p-5 lg:p-7 antialiased selection:bg-indigo-500 selection:text-white">
      {/* 1. Header */}
      <Header
        versionLabel="Bản VER2 (Phân Tab Segmented)"
        isInternetOnline={telemetry.isInternetOnline}
        isEspOnline={telemetry.isEspOnline}
        lastTelemetryTime={telemetry.lastTelemetryTime}
        isSimulating={telemetry.isSimulating}
        onToggleSimulation={telemetry.toggleSimulation}
      />

      {/* 2. Cảnh báo tổng */}
      <AlarmBanner
        indoor={telemetry.state.indoor}
        outdoor={telemetry.state.outdoor}
      />

      {/* 3. Khối Segmented Control chuyển đổi Tab 50/50 */}
      <div className="max-w-7xl mx-auto mb-7">
        <div className="relative flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          {/* Khối trượt màu Indigo */}
          <div
            className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-indigo-600 rounded-xl transition-all duration-300 ease-in-out shadow-lg ${
              activeTab === 'control' ? 'translate-x-0' : 'translate-x-full'
            }`}
          />

          {/* Tab 1: ĐIỀU KHIỂN & THÔNG SỐ */}
          <button
            onClick={() => setActiveTab('control')}
            className={`relative z-10 flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-colors duration-300 flex items-center justify-center gap-2 ${
              activeTab === 'control' ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>ĐIỀU KHIỂN & THÔNG SỐ</span>
          </button>

          {/* Tab 2: BIỂU ĐỒ THỜI GIAN THỰC */}
          <button
            onClick={() => setActiveTab('chart')}
            className={`relative z-10 flex-1 py-3 text-xs sm:text-sm font-bold text-center transition-colors duration-300 flex items-center justify-center gap-2 ${
              activeTab === 'chart' ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>BIỂU ĐỒ THỜI GIAN THỰC</span>
          </button>
        </div>
      </div>

      {/* 4. Nội dung Tab hiển thị */}
      <main className="max-w-7xl mx-auto space-y-7">
        {activeTab === 'control' ? (
          <div className="space-y-7 animate-fadeIn">
            {/* Cảm biến */}
            <EnvironmentCards
              indoor={telemetry.state.indoor}
              outdoor={telemetry.state.outdoor}
            />

            {/* Điều khiển */}
            <ActuatorControls
              mode={telemetry.state.mode}
              actuators={telemetry.state.actuators}
              onSendCommand={telemetry.sendCommand}
            />
          </div>
        ) : (
          <div className="space-y-7 animate-fadeIn">
            {/* Biểu đồ */}
            <RealtimeChart history={telemetry.history} />
          </div>
        )}

        {/* Khối Đo độ trễ & Console luôn nằm bên dưới */}
        <TelemetryConsole
          telemetryLatency={telemetry.telemetryLatency}
          commandLatency={telemetry.commandLatency}
          logs={telemetry.logs}
          onClearLogs={telemetry.clearLogs}
          onSendPing={() => telemetry.sendCommand({ ping: Date.now() })}
        />
      </main>
    </div>
  );
}