import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import { IncidentManagementScreen } from '../src/features/incidents/IncidentManagementScreen';
import { mockIncidentService } from '../src/services/mock/mockIncidentService';

describe('Milestone M7: Automated Incident Detection & SLO Violation Triage UI', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockIncidentService.reset();
  });

  it('renders incident management screen with KPI summary cards and incident rows', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <IncidentManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    // Screen title and badge
    expect(screen.getByText(/Automated Incident Detection & Triage/i)).toBeInTheDocument();
    expect(screen.getByText(/M7 Engine Active/i)).toBeInTheDocument();

    // Live KPI cards
    expect(screen.getByText(/Total Catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Active \/ Open/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Investigating/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/^Resolved$/i)[0]).toBeInTheDocument();

    // Wait for mock incidents to load
    await waitFor(() => {
      expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/payment-ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 5xx Error Rate Surge/i)).toBeInTheDocument();
    expect(screen.getByText(/Pod Readiness Deficit/i)).toBeInTheDocument();
  });

  it('filters incidents by search query', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <IncidentManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter by service, fingerprint, title.../i);
    fireEvent.change(searchInput, { target: { value: 'payment-ledger' } });

    expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pod Readiness Deficit/i)).not.toBeInTheDocument();
  });

  it('filters incidents by severity dropdown', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <IncidentManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    });

    const severitySelect = screen.getByLabelText(/Filter by Severity/i);
    fireEvent.change(severitySelect, { target: { value: 'CRITICAL' } });

    expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pod Readiness Deficit/i)).not.toBeInTheDocument();
  });

  it('opens incident drawer and displays timeline, topology, and evidence tabs', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <IncidentManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    });

    // Inspect the latency breach incident
    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[0]);

    // Drawer header details
    await waitFor(() => {
      expect(screen.getByText(/Immutable Audit Timeline/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Telemetry breach detected by PromQL rule-p99-latency/i)).toBeInTheDocument();

    // Switch to Topology & Symptoms tab
    const topologyTab = screen.getByRole('button', { name: /Topology & Symptoms/i });
    fireEvent.click(topologyTab);
    expect(screen.getByText(/Affected Service Dependency Graph \(M4 Correlation\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Correlated Upstream Symptom Callers/i)).toBeInTheDocument();

    // Switch to Evidence Package tab
    const evidenceTab = screen.getByRole('button', { name: /Evidence Package/i });
    fireEvent.click(evidenceTab);
    expect(screen.getByText(/PromQL Telemetry Snapshot at Breach Time/i)).toBeInTheDocument();
    expect(screen.getAllByText(/FRESH/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/tr-89f2c4a10e/i)).toBeInTheDocument();

    // Switch to Chaos Correlation tab
    const chaosTab = screen.getByRole('button', { name: /Chaos Correlation/i });
    fireEvent.click(chaosTab);
    expect(screen.getByText(/Contextual Chaos Experiment Correlation/i)).toBeInTheDocument();
    expect(screen.getByText(/LATENCY_INJECTION/i)).toBeInTheDocument();
  });

  it('executes lifecycle transition from OPEN to ACKNOWLEDGED', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <IncidentManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[0]);

    // Click "Acknowledge" button in drawer control bar
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Acknowledge$/i })).toBeInTheDocument();
    });

    const ackButton = screen.getByRole('button', { name: /^Acknowledge$/i });
    fireEvent.click(ackButton);

    // Verify status changes to ACKNOWLEDGED
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Investigate$/i })).toBeInTheDocument();
    });
  });

  it('enforces RBAC read-only restrictions for Viewer role', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-auditor');
    sessionStorage.setItem('chaos_user_email', 'auditor.compliance@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <IncidentManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/High Latency P99 Breach/i)).toBeInTheDocument();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[0]);

    // Viewer should see the disabled indicator and no action buttons
    await waitFor(() => {
      expect(screen.getByText(/Operator actions disabled \(Viewer Role\)/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^Acknowledge$/i })).not.toBeInTheDocument();
  });

  it('runs detection evaluation when button is clicked', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <IncidentManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    const evaluateBtn = screen.getByTestId('evaluate-incidents-btn');
    fireEvent.click(evaluateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Evaluation complete:/i)).toBeInTheDocument();
    });
  });
});
