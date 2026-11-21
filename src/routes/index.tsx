import React, { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ChaosLabScreen } from '../components/ChaosLabScreen';
import { EmptyState } from '../components/EmptyState';
import { LogsTracesScreen } from '../components/LogsTracesScreen';
import { TelemetryOverviewScreen } from '../components/TelemetryOverviewScreen';
import { TopologyScreen } from '../components/TopologyScreen';
import { useTelemetry } from '../context/TelemetryContext';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RegisterPage } from '../features/auth/RegisterPage';
import { IncidentManagementScreen } from '../features/incidents/IncidentManagementScreen';
import { PostmortemWorkspace } from '../features/postmortems/PostmortemWorkspace';
import { SandboxManagementScreen } from '../features/sandboxes/SandboxManagementScreen';
import { SettingsPage } from '../features/settings/SettingsPage';
import { InteractiveTopologyEditor } from '../features/topology/InteractiveTopologyEditor';
import { AppLayout } from '../layout/AppLayout';

export const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    cluster,
    timeRange,
    services,
    series,
    experiments,
    logs,
    launchExperiment,
    haltExperiment,
    quickInjectLatency,
    haltServiceFaults,
    clearLogs,
    setInspectedServiceId,
  } = useTelemetry();

  // Route-level state for cross-screen deep-linking
  const [topologySelectedId, setTopologySelectedId] = useState<string>(
    (location.state as { selectedServiceId?: string })?.selectedServiceId || 'checkout-core'
  );
  const [logFilterSeed, setLogFilterSeed] = useState<string>(
    (location.state as { logFilterSeed?: string })?.logFilterSeed || ''
  );

  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Application Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={
            <TelemetryOverviewScreen
              cluster={cluster}
              timeRange={timeRange}
              services={services}
              series={series}
              experiments={experiments}
              onSelectService={(svc) => setInspectedServiceId(svc.id)}
              onNavigate={(screen) => navigate(screen === 'telemetry' ? '/' : `/${screen}`)}
            />
          }
        />
        <Route path="/telemetry" element={<Navigate to="/" replace />} />
        <Route
          path="/chaos"
          element={
            <ChaosLabScreen
              cluster={cluster}
              services={services}
              experiments={experiments}
              onLaunchExperiment={launchExperiment}
              onHaltExperiment={haltExperiment}
              onInspectService={(svc) => setInspectedServiceId(svc.id)}
            />
          }
        />
        <Route
          path="/topology"
          element={<InteractiveTopologyEditor />}
        />
        <Route
          path="/logs"
          element={
            <LogsTracesScreen
              logs={logs}
              initialFilter={logFilterSeed}
              onClearFilter={() => setLogFilterSeed('')}
              onClearLogs={clearLogs}
            />
          }
        />

        {/* Future Platform Screens Stubs with EmptyState */}
        <Route
          path="/sandboxes"
          element={<SandboxManagementScreen />}
        />
        <Route
          path="/incidents"
          element={<IncidentManagementScreen />}
        />
        <Route
          path="/reports"
          element={<PostmortemWorkspace />}
        />
        <Route
          path="/settings"
          element={<SettingsPage />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};
