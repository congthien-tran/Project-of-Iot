import React from 'react';
import { useTelemetry } from './hooks/useTelemetry';
import { Header } from './components/Header';
import { AlarmBanner } from './components/AlarmBanner';
import { RealtimeChart } from './components/RealtimeChart';
import { EnvironmentCards } from './components/EnvironmentCards';
import { ActuatorControls } from './components/ActuatorControls';
import { TelemetryConsole } from './components/TelemetryConsole';

export default function App_VER1() {
  const telemetry = useTelemetry();

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen p-3 sm:p-5 lg:p-7 antialiased selection:bg-indigo-500 selection:text-white">
      {/* 1. Header */}
      <Header
        versionLabel="Bản VER1 (Cuộn Toàn Trang)"
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

      {/* 3. Main Container dạng cuộn toàn bộ */}
      <main className="max-w-7xl mx-auto space-y-7">
        {/* Biểu đồ đặt ngay sau Header */}
        <RealtimeChart history={telemetry.history} />

        {/* Khối Cảm biến Trong nhà & Ngoài trời */}
        <EnvironmentCards
          indoor={telemetry.state.indoor}
          outdoor={telemetry.state.outdoor}
        />

        {/* Khối Điều khiển Quạt & Đèn LED */}
        <ActuatorControls
          mode={telemetry.state.mode}
          actuators={telemetry.state.actuators}
          onSendCommand={telemetry.sendCommand}
        />

        {/* Khối Đo độ trễ & Nhật ký Console */}
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