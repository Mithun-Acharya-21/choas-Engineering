import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import { RCAInvestigationWorkspace } from '../src/features/rca/RCAInvestigationWorkspace';
import { mockRcaService } from '../src/services/mock/mockRcaService';

describe('Milestone M8: Deterministic Root Cause Analysis (RCA) Workspace UI', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockRcaService.reset();
  });

  it('renders RCA workspace with ranked candidates, scores, and confidence classifications', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <RCAInvestigationWorkspace
            incidentId="inc-9901-latency-breach"
            incidentTitle="High Latency P99 Breach (> 500ms)"
          />
        </AuthProvider>
      </MemoryRouter>
    );

    // Screen title and version pill
    expect(screen.getByText(/Deterministic Root Cause Analysis \(M8\)/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/v1.0.0-deterministic/i)).toBeInTheDocument();
    });

    // Primary Candidate #1
    expect(screen.getAllByText(/Payment Ledger/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/HIGH CONFIDENCE/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/PRIMARY CAUSE/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/88.5/i)[0]).toBeInTheDocument();

    // Collateral Symptoms
    expect(screen.getByText(/Checkout Core/i)).toBeInTheDocument();
    expect(screen.getByText(/API Gateway/i)).toBeInTheDocument();
    expect(screen.getAllByText(/COLLATERAL SYMPTOM/i)[0]).toBeInTheDocument();
  });

  it('displays transparent score factor breakdown for selected candidate', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <RCAInvestigationWorkspace
            incidentId="inc-9901-latency-breach"
            incidentTitle="High Latency P99 Breach"
          />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Score Factor Breakdown/i)).toBeInTheDocument();
    });

    // Switch to Score Factor Breakdown tab
    const factorsTab = screen.getByRole('button', { name: /Score Factor Breakdown/i });
    fireEvent.click(factorsTab);

    // Factor names and weighted score contributions
    expect(screen.getByText(/Span Latency Contribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Temporal Precedence/i)).toBeInTheDocument();
    expect(screen.getByText(/Metric Anomaly Magnitude/i)).toBeInTheDocument();
    expect(screen.getByText(/Topology Dependency Depth/i)).toBeInTheDocument();
    expect(screen.getByText(/Experiment Alignment/i)).toBeInTheDocument();
    expect(screen.getByText(/\+23\.0 pts/i)).toBeInTheDocument();
  });

  it('displays supporting and contradicting evidence panels', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <RCAInvestigationWorkspace
            incidentId="inc-9901-latency-breach"
            incidentTitle="High Latency P99 Breach"
          />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Supporting Observations/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Exclusive span self-duration measured at 842.0ms/i)).toBeInTheDocument();
    expect(screen.getByText(/Contradicting \/ Mitigating Observations/i)).toBeInTheDocument();
    expect(screen.getByText(/Outbound database query to orders-db remained fast/i)).toBeInTheDocument();
  });

  it('displays failure propagation paths and causal flow', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <RCAInvestigationWorkspace
            incidentId="inc-9901-latency-breach"
            incidentTitle="High Latency P99 Breach"
          />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Failure Propagation DAG/i })).toBeInTheDocument();
    });

    const propTab = screen.getByRole('button', { name: /Failure Propagation DAG/i });
    fireEvent.click(propTab);

    expect(screen.getByText(/Failure Propagation Paths \(M4 Topology Graph\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/payment-ledger/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/2 hop\(s\)/i)[0]).toBeInTheDocument();
  });

  it('allows SRE to trigger re-run analysis', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <RCAInvestigationWorkspace
            incidentId="inc-9901-latency-breach"
            incidentTitle="High Latency P99 Breach"
          />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Re-run Analysis/i })).toBeInTheDocument();
    });

    const rerunBtn = screen.getByRole('button', { name: /Re-run Analysis/i });
    fireEvent.click(rerunBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Payment Ledger/i)[0]).toBeInTheDocument();
    });
  });

  it('enforces RBAC read-only restrictions for Viewer role', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-auditor');
    sessionStorage.setItem('chaos_user_email', 'auditor.compliance@acme.com');

    render(
      <MemoryRouter>
        <AuthProvider>
          <RCAInvestigationWorkspace
            incidentId="inc-9901-latency-breach"
            incidentTitle="High Latency P99 Breach"
          />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Viewer Read-Only Mode/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Re-run Analysis/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run Deterministic RCA/i })).not.toBeInTheDocument();
  });
});
