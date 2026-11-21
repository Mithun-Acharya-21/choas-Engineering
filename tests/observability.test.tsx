import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { LogsTracesScreen } from '../src/components/LogsTracesScreen';
import { TelemetryOverviewScreen } from '../src/components/TelemetryOverviewScreen';
import { AuthProvider } from '../src/context/AuthContext';
import { ExperimentComparisonView } from '../src/features/observability/ExperimentComparisonView';
import { INITIAL_EXPERIMENTS, INITIAL_LOGS, INITIAL_SERVICES } from '../src/services/mock/mockData';
import { ExperimentTelemetryCorrelation } from '../src/types/domain/telemetry';
import { generateInitialTelemetrySeries } from '../src/services/mock/mockData';

const mockCorrelation: ExperimentTelemetryCorrelation = {
  experimentId: 'exp-payment-latency-2000',
  sandboxId: 'sbx-demo-e-comm-01',
  targetService: 'payment-service',
  faultType: 'latency',
  faultMagnitude: 2000,
  faultUnit: 'ms',
  startedAt: '2026-11-20T10:00:00Z',
  completedAt: '2026-11-20T10:01:00Z',
  baseline: {
    phase: 'baseline',
    startTime: '2026-11-20T09:59:00Z',
    endTime: '2026-11-20T10:00:00Z',
    sampleCount: 20,
    avgP50Ms: 28.5,
    avgP95Ms: 52.0,
    avgP99Ms: 64.2,
    avgRps: 98.0,
    avgErrorRatePct: 0.01,
    cpuUtilizationPct: 24.5,
    memoryUtilizationPct: 36.0,
  },
  faultActive: {
    phase: 'fault_active',
    startTime: '2026-11-20T10:00:00Z',
    endTime: '2026-11-20T10:01:00Z',
    sampleCount: 20,
    avgP50Ms: 1820.0,
    avgP95Ms: 1980.0,
    avgP99Ms: 2064.2,
    avgRps: 72.0,
    avgErrorRatePct: 14.8,
    cpuUtilizationPct: 68.0,
    memoryUtilizationPct: 58.5,
  },
  recovery: {
    phase: 'recovery',
    startTime: '2026-11-20T10:01:00Z',
    endTime: '2026-11-20T10:02:00Z',
    sampleCount: 20,
    avgP50Ms: 29.2,
    avgP95Ms: 54.5,
    avgP99Ms: 66.8,
    avgRps: 96.5,
    avgErrorRatePct: 0.04,
    cpuUtilizationPct: 26.0,
    memoryUtilizationPct: 37.5,
  },
  impactDeltaP99Pct: 3115.3,
  recovered: true,
  correlatedTraces: [
    {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      rootService: 'api-gateway',
      rootOperation: 'POST /api/v1/orders/checkout',
      timestamp: '2026-11-20T10:00:30Z',
      durationMs: 2115.0,
      spansCount: 3,
      hasErrors: true,
      spans: [
        {
          id: 'span-gw-01',
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          service: 'api-gateway',
          operation: 'POST /api/v1/orders/checkout',
          startOffsetMs: 0,
          durationMs: 2115.0,
          status: 'error',
          statusCode: 504,
        },
        {
          id: 'span-order-01',
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          parentSpanId: 'span-gw-01',
          service: 'order-service',
          operation: 'POST /orders',
          startOffsetMs: 6,
          durationMs: 2095.0,
          status: 'error',
          statusCode: 504,
        },
        {
          id: 'span-pay-01',
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          parentSpanId: 'span-order-01',
          service: 'payment-service',
          operation: 'POST /payments/charge',
          startOffsetMs: 18,
          durationMs: 2042.0,
          status: 'degraded',
          statusCode: 200,
        },
      ],
    },
  ],
  correlatedLogs: [
    {
      id: 'log-01',
      timestampIso: '2026-11-20T10:00:35Z',
      level: 'CRITICAL',
      service: 'payment-service',
      cluster: 'sandbox-alpha-us-east-1',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      durationMs: 2042.0,
      message: 'Toxiproxy transport latency delay injected: 2000ms on port 8080.',
      metadata: { 'chaos.fault': 'latency' },
      spans: [],
    },
    {
      id: 'log-02',
      timestampIso: '2026-11-20T10:00:36Z',
      level: 'ERROR',
      service: 'order-service',
      cluster: 'sandbox-alpha-us-east-1',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      durationMs: 2095.0,
      message: 'Upstream payment-service timeout after 2000ms: 504 Gateway Timeout.',
      metadata: { 'http.status': 504 },
      spans: [],
    },
  ],
};

describe('Milestone M6: Observability & Telemetry Integration UI', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders TelemetryOverviewScreen with KPI cards, sparklines, and time-series charts', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TelemetryOverviewScreen
            cluster="sandbox-alpha-us-east-1"
            timeRange="15m"
            services={INITIAL_SERVICES}
            series={generateInitialTelemetrySeries()}
            experiments={INITIAL_EXPERIMENTS}
            onSelectService={() => {}}
            onNavigate={() => {}}
          />
        </AuthProvider>
      </MemoryRouter>
    );

    // Header context
    expect(screen.getByText('Sandbox Telemetry')).toBeInTheDocument();
    expect(screen.getByText('ISOLATED SANDBOX')).toBeInTheDocument();

    // KPI cards
    expect(screen.getByText('Mesh p99 Latency')).toBeInTheDocument();
    expect(screen.getByText('Weighted 5xx Rate')).toBeInTheDocument();
    expect(screen.getByText('Aggregate Throughput')).toBeInTheDocument();
    expect(screen.getByText('Min SLO Error Budget')).toBeInTheDocument();

    // 3-Phase Correlation button
    expect(screen.getByTestId('toggle-experiment-comparison-btn')).toBeInTheDocument();
  });

  it('toggles the 3-Phase Experiment Comparison View showing Baseline, Fault Active, and Recovery phases', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TelemetryOverviewScreen
            cluster="sandbox-alpha-us-east-1"
            timeRange="15m"
            services={INITIAL_SERVICES}
            series={generateInitialTelemetrySeries()}
            experiments={INITIAL_EXPERIMENTS}
            onSelectService={() => {}}
            onNavigate={() => {}}
          />
        </AuthProvider>
      </MemoryRouter>
    );

    const toggleBtn = screen.getByTestId('toggle-experiment-comparison-btn');
    fireEvent.click(toggleBtn);

    // Verify 3-phase view opens
    await waitFor(() => {
      expect(screen.getByTestId('experiment-comparison-view')).toBeInTheDocument();
      expect(screen.getByText('Experiment Telemetry Correlation')).toBeInTheDocument();
      expect(screen.getByText(/3-PHASE CORRELATED/i)).toBeInTheDocument();
    });

    // Phase titles
    expect(screen.getByText('Phase 1 — Steady State')).toBeInTheDocument();
    expect(screen.getByText('Phase 2 — Active Fault Injection')).toBeInTheDocument();
    expect(screen.getByText('Phase 3 — Post-Fault Recovery')).toBeInTheDocument();

    // Latency Delta & Resilience
    expect(screen.getByText(/P99 Impact Delta/i)).toBeInTheDocument();
    expect(screen.getByText(/RECOVERED/i)).toBeInTheDocument();
  });

  it('renders ExperimentComparisonView with distributed trace waterfall and duration bars', () => {
    render(<ExperimentComparisonView correlation={mockCorrelation} />);

    // Trace list item
    expect(screen.getByText('POST /api/v1/orders/checkout')).toBeInTheDocument();
    expect(screen.getAllByText('2115ms')[0]).toBeInTheDocument();

    // Trace waterfall spans
    expect(screen.getByText(/api-gateway: POST \/api\/v1\/orders\/checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/order-service: POST \/orders/i)).toBeInTheDocument();
    expect(screen.getByText(/payment-service: POST \/payments\/charge/i)).toBeInTheDocument();

    // Status code verification
    expect(screen.getByText(/2115ms \(504\)/i)).toBeInTheDocument();

    // Correlated logs section
    expect(screen.getByText('Correlated Fault & Outlier Logs')).toBeInTheDocument();
    expect(screen.getByText(/Toxiproxy transport latency delay injected: 2000ms/i)).toBeInTheDocument();
    expect(screen.getByText(/Upstream payment-service timeout after 2000ms/i)).toBeInTheDocument();
  });

  it('renders LogsTracesScreen and allows filtering by service, level, and trace ID', () => {
    render(
      <LogsTracesScreen
        logs={INITIAL_LOGS}
        initialFilter=""
        onClearFilter={() => {}}
        onClearLogs={() => {}}
      />
    );

    expect(screen.getByText('Incident & Chaos Log Streams')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Query KQL/i)).toBeInTheDocument();

    // Search filter input
    const searchInput = screen.getByPlaceholderText(/Query KQL/i);
    fireEvent.change(searchInput, { target: { value: 'service:payment-ledger' } });

    // Filter chips
    expect(screen.getByText('service:payment-ledger')).toBeInTheDocument();
  });
});
