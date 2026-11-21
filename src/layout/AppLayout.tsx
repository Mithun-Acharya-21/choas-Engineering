import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../components/CommandPalette';
import { ServiceInspectorDrawer } from '../components/ServiceInspectorDrawer';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { useTelemetry } from '../context/TelemetryContext';
import { ScreenId } from '../types/telemetry';

interface AppLayoutProps {
  children?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const {
    cluster,
    setCluster,
    timeRange,
    setTimeRange,
    isLive,
    setIsLive,
    services,
    experiments,
    runningFaultCount,
    inspectedService,
    setInspectedServiceId,
    commandOpen,
    setCommandOpen,
    haltAllFaults,
    quickInjectLatency,
    haltServiceFaults,
    isMockMode,
  } = useTelemetry();

  // Map route pathname to ScreenId
  const getActiveScreen = (): ScreenId => {
    const path = location.pathname.replace(/^\//, '');
    if (path === 'chaos') return 'chaos';
    if (path === 'topology') return 'topology';
    if (path === 'logs') return 'logs';
    if (path === 'settings') return 'settings';
    return 'telemetry';
  };

  const activeScreen = getActiveScreen();

  const handleSelectScreen = (screen: ScreenId) => {
    if (screen === 'telemetry') navigate('/');
    else navigate(`/${screen}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-[#fafafa]">
      <Sidebar
        activeScreen={activeScreen}
        onSelectScreen={handleSelectScreen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        cluster={cluster}
        onSelectCluster={setCluster}
        runningFaultCount={runningFaultCount}
        isLive={isLive}
        onToggleLive={() => setIsLive((l) => !l)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          cluster={cluster}
          activeScreen={activeScreen}
          timeRange={timeRange}
          onSelectTimeRange={setTimeRange}
          runningFaultCount={runningFaultCount}
          onHaltAllFaults={haltAllFaults}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          isMockData={isMockMode}
        />

        <main className="flex-1 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>

      <ServiceInspectorDrawer
        service={inspectedService}
        experiments={experiments}
        onClose={() => setInspectedServiceId(null)}
        onQuickInjectLatency={quickInjectLatency}
        onHaltServiceFaults={haltServiceFaults}
        onOpenTopology={(id) => {
          navigate('/topology', { state: { selectedServiceId: id } });
        }}
        onOpenLogs={(name) => {
          navigate('/logs', { state: { logFilterSeed: `service:${name}` } });
        }}
      />

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        services={services}
        isLive={isLive}
        runningFaultCount={runningFaultCount}
        onNavigate={handleSelectScreen}
        onInspectService={(svc) => setInspectedServiceId(svc.id)}
        onToggleLive={() => setIsLive((l) => !l)}
        onHaltAllFaults={haltAllFaults}
      />
    </div>
  );
};
