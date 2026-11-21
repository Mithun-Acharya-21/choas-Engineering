import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../src/context/AuthContext';
import { PostmortemWorkspace } from '../src/features/postmortems/PostmortemWorkspace';

describe('Milestone M9: AI-Assisted RCA Explanations & Incident Postmortems', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders postmortem workspace with authoritative M8 findings and M9 AI synthesis layer', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com');

    render(
      <MemoryRouter initialEntries={['/reports?incidentId=inc-9901-latency-breach']}>
        <AuthProvider>
          <PostmortemWorkspace />
        </AuthProvider>
      </MemoryRouter>
    );

    // Header and M9 Active badge
    await waitFor(() => {
      expect(screen.getByText(/Milestone M9 Active/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Postmortem: Checkout Latency Surge/i)).toBeInTheDocument();

    // Authoritative M8 Ground Truth Card
    expect(screen.getByText(/M8 Authoritative Ground Truth/i)).toBeInTheDocument();
    expect(screen.getAllByText(/payment-service/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/94.5 \/ 100/i)).toBeInTheDocument();
    expect(screen.getByText(/Single Source of Truth/i)).toBeInTheDocument();

    // M9 AI Synthesis Layer Card
    expect(screen.getByText(/M9 AI Synthesis Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Grounded Citations/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Hallucinations/i)).toBeInTheDocument();

    // Executive Summary
    expect(screen.getByText(/1\. Executive Summary/i)).toBeInTheDocument();
    expect(
      screen.getByText(/automated chaos experiment \(exp-9411\) injected 350ms/i)
    ).toBeInTheDocument();
  });

  it('navigates between narrative, recommendations, action items, and timeline tabs', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter initialEntries={['/reports?incidentId=inc-9901-latency-breach']}>
        <AuthProvider>
          <PostmortemWorkspace />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Executive & Technical Narrative/i)).toBeInTheDocument();
    });

    // Switch to Recommendations tab
    const recsTab = screen.getByText(/Categorized Recommendations/i);
    fireEvent.click(recsTab);

    expect(screen.getByText(/Immediate Mitigation/i)).toBeInTheDocument();
    expect(screen.getByText(/Root-Cause Remediation/i)).toBeInTheDocument();
    expect(screen.getByText(/Preventive Action/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Requires Human Approval/i).length).toBeGreaterThanOrEqual(1);

    // Switch to Action Items tab
    const actionTab = screen.getByText(/Action Items Tracker/i);
    fireEvent.click(actionTab);

    expect(screen.getByText(/Action Items & Ownership/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Implement Istio Circuit Breaker DestinationRule for payment-service/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/sarah\.sre@acme\.com/i).length).toBeGreaterThanOrEqual(1);

    // Switch to Timeline tab
    const timelineTab = screen.getByText(/Incident Timeline & Audit History/i);
    fireEvent.click(timelineTab);

    expect(screen.getByText(/Incident Sequence of Events/i)).toBeInTheDocument();
    expect(screen.getByText(/T-00:00/i)).toBeInTheDocument();
    expect(screen.getByText(/T\+02:00/i)).toBeInTheDocument();
  });

  it('allows adding a new action item in the action items tab', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter initialEntries={['/reports?incidentId=inc-9901-latency-breach']}>
        <AuthProvider>
          <PostmortemWorkspace />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Action Items Tracker/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Action Items Tracker/i));

    // Click Add Action Item
    const addBtn = screen.getByRole('button', { name: /Add Action Item/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Add Corrective Action Item/i)).toBeInTheDocument();

    // Fill form
    const titleInput = screen.getByPlaceholderText(/e\.g\. Implement Circuit Breaker/i);
    fireEvent.change(titleInput, { target: { value: 'Configure HPA Autoscaling Target to 65%' } });

    const descInput = screen.getByPlaceholderText(/Detailed engineering steps/i);
    fireEvent.change(descInput, { target: { value: 'Modify k8s/hpa.yaml and deploy to cluster.' } });

    // Submit
    const saveBtn = screen.getByRole('button', { name: /Save Action Item/i });
    fireEvent.click(saveBtn);

    // Verify added to table
    await waitFor(() => {
      expect(
        screen.getByText(/Configure HPA Autoscaling Target to 65%/i)
      ).toBeInTheDocument();
    });
  });

  it('triggers PDF download when Download PDF button is clicked', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MemoryRouter initialEntries={['/reports?incidentId=inc-9901-latency-breach']}>
        <AuthProvider>
          <PostmortemWorkspace />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', { name: /Download PDF/i });
    fireEvent.click(downloadBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('/postmortems/'),
      '_blank'
    );
  });
});
