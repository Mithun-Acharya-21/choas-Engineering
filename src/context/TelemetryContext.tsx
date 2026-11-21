import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { mockTelemetryService } from '../services/mock/mockTelemetryService';
import {
  ChaosExperiment,
  ClusterId,
  FaultType,
  LogEntry,
  ScreenId,
  ServiceNode,
  TelemetryPoint,
  TimeRange,
} from '../types/telemetry';

interface TelemetryContextType {
  cluster: ClusterId;
  setCluster: (cluster: ClusterId) => void;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  isLive: boolean;
  setIsLive: (live: boolean | ((prev: boolean) => boolean)) => void;
  services: ServiceNode[];
  experiments: ChaosExperiment[];
  series: TelemetryPoint[];
  logs: LogEntry[];
  runningFaultCount: number;
  inspectedServiceId: string | null;
  setInspectedServiceId: (id: string | null) => void;
  inspectedService: ServiceNode | null;
  commandOpen: boolean;
  setCommandOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  launchExperiment: (payload: {
    name: string;
    targetServiceId: string;
    faultType: FaultType;
    magnitude: number;
    blastRadiusPct: number;
    durationSec: number;
    hypothesis: string;
  }) => void;
  haltExperiment: (experimentId: string) => void;
  haltAllFaults: () => void;
  quickInjectLatency: (serviceId: string) => void;
  haltServiceFaults: (serviceId: string) => void;
  clearLogs: () => void;
  isMockMode: boolean;
}

const TelemetryContext = createContext<TelemetryContextType | null>(null);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cluster, setClusterState] = useState<ClusterId>(mockTelemetryService.getActiveCluster());
  const [timeRange, setTimeRange] = useState<TimeRange>('15m');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [inspectedServiceId, setInspectedServiceId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState<boolean>(false);

  const [services, setServices] = useState<ServiceNode[]>(() => mockTelemetryService.getServices());
  const [experiments, setExperiments] = useState<ChaosExperiment[]>(() => mockTelemetryService.getExperiments());
  const [series, setSeries] = useState<TelemetryPoint[]>(() => mockTelemetryService.getTelemetrySeries());
  const [logs, setLogs] = useState<LogEntry[]>(() => mockTelemetryService.getLogs());

  const isMockMode = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

  const runningFaultCount = useMemo(
    () => experiments.filter((e) => e.status === 'running').length,
    [experiments]
  );

  const inspectedService = useMemo(
    () => services.find((s) => s.id === inspectedServiceId) ?? null,
    [services, inspectedServiceId]
  );

  const setCluster = useCallback((nextCluster: ClusterId) => {
    setClusterState(nextCluster);
    mockTelemetryService.setActiveCluster(nextCluster);
    setServices(mockTelemetryService.getServices());
  }, []);

  // Global Cmd+K keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Live 2s Telemetry Engine loop
  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      const state = mockTelemetryService.tick();
      setServices(state.services);
      setExperiments(state.experiments);
      setSeries(state.series);
      setLogs(state.logs);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [isLive]);

  const launchExperiment = useCallback(
    (payload: {
      name: string;
      targetServiceId: string;
      faultType: FaultType;
      magnitude: number;
      blastRadiusPct: number;
      durationSec: number;
      hypothesis: string;
    }) => {
      mockTelemetryService.launchExperiment(payload);
      setServices(mockTelemetryService.getServices());
      setExperiments(mockTelemetryService.getExperiments());
      setLogs(mockTelemetryService.getLogs());
    },
    []
  );

  const haltExperiment = useCallback((experimentId: string) => {
    mockTelemetryService.haltExperiment(experimentId);
    setServices(mockTelemetryService.getServices());
    setExperiments(mockTelemetryService.getExperiments());
    setLogs(mockTelemetryService.getLogs());
  }, []);

  const haltAllFaults = useCallback(() => {
    mockTelemetryService.haltAllActiveFaults();
    setServices(mockTelemetryService.getServices());
    setExperiments(mockTelemetryService.getExperiments());
    setLogs(mockTelemetryService.getLogs());
  }, []);

  const quickInjectLatency = useCallback(
    (serviceId: string) => {
      const svc = services.find((s) => s.id === serviceId);
      if (!svc) return;
      launchExperiment({
        name: `sbx-${svc.name}-latency-200ms`,
        targetServiceId: svc.id,
        faultType: 'latency',
        magnitude: 200,
        blastRadiusPct: 30,
        durationSec: 180,
        hypothesis: `Quick +200ms Toxiproxy delay test on ${svc.name} in ${svc.namespace}.`,
      });
    },
    [services, launchExperiment]
  );

  const haltServiceFaults = useCallback(
    (serviceId: string) => {
      const runningForService = experiments.filter(
        (e) => e.status === 'running' && e.targetServiceId === serviceId
      );
      runningForService.forEach((e) => haltExperiment(e.id));
    },
    [experiments, haltExperiment]
  );

  const clearLogs = useCallback(() => {
    mockTelemetryService.clearLogs();
    setLogs([]);
  }, []);

  const value = useMemo(
    () => ({
      cluster,
      setCluster,
      timeRange,
      setTimeRange,
      isLive,
      setIsLive,
      services,
      experiments,
      series,
      logs,
      runningFaultCount,
      inspectedServiceId,
      setInspectedServiceId,
      inspectedService,
      commandOpen,
      setCommandOpen,
      launchExperiment,
      haltExperiment,
      haltAllFaults,
      quickInjectLatency,
      haltServiceFaults,
      clearLogs,
      isMockMode,
    }),
    [
      cluster,
      setCluster,
      timeRange,
      isLive,
      services,
      experiments,
      series,
      logs,
      runningFaultCount,
      inspectedServiceId,
      inspectedService,
      commandOpen,
      launchExperiment,
      haltExperiment,
      haltAllFaults,
      quickInjectLatency,
      haltServiceFaults,
      clearLogs,
      isMockMode,
    ]
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export const useTelemetry = (): TelemetryContextType => {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return ctx;
};
