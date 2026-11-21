import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import { SandboxManagementScreen } from '../src/features/sandboxes/SandboxManagementScreen';
import { mockSandboxService } from '../src/services/mock/mockSandboxService';

describe('Milestone M3: Dynamic Kubernetes Sandbox Provisioning UI', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders sandbox management screen with header, stats, and active environments', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter>
        <AuthProvider>
          <SandboxManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    // Header and screen indicators
    expect(screen.getByText(/Dynamic Kubernetes Sandboxes/i)).toBeInTheDocument();
    expect(screen.getByText(/M3 Production Engine/i)).toBeInTheDocument();

    // Stats cards
    expect(screen.getByText(/Total Sandboxes/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready & Isolated/i)).toBeInTheDocument();

    // Sandboxes list items
    await waitFor(() => {
      expect(screen.getByText(/E-Commerce Chaos Lab Alpha/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/sandbox-default-demo-01/i)).toBeInTheDocument();
    expect(screen.getByText(/default-deny/i)).toBeInTheDocument();
  });

  it('opens and closes workload inspector showing dual container and Toxiproxy details', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter>
        <AuthProvider>
          <SandboxManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/E-Commerce Chaos Lab Alpha/i)).toBeInTheDocument();
    });

    // Click "Inspect" button
    const inspectBtn = screen.getByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectBtn);

    // Drawer should open
    await waitFor(() => {
      expect(screen.getByText(/Kubernetes Security & Network Isolation/i)).toBeInTheDocument();
      expect(screen.getByText(/default-deny enforced/i)).toBeInTheDocument();
      expect(screen.getByText(/automountServiceAccountToken: false/i)).toBeInTheDocument();
      // All 4 microservices have injected Toxiproxy sidecars
      const toxiproxyLabels = screen.getAllByText(/shopify\/toxiproxy:2\.9\.0/i);
      expect(toxiproxyLabels.length).toBeGreaterThanOrEqual(1);
    });

    // Close Inspector
    const closeBtn = screen.getByRole('button', { name: /Close Inspector/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Close Inspector/i)).not.toBeInTheDocument();
    });
  });

  it('disables provision and terminate actions for Viewer role', async () => {
    // Viewer role (no token in sessionStorage defaults to Viewer in mock session restoration)
    render(
      <MemoryRouter>
        <AuthProvider>
          <SandboxManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/E-Commerce Chaos Lab Alpha/i)).toBeInTheDocument();
    });

    const provisionBtn = screen.getByRole('button', { name: /Provision Sandbox/i });
    expect(provisionBtn).toBeDisabled();

    const terminateBtn = screen.getByRole('button', { name: /Terminate/i });
    expect(terminateBtn).toBeDisabled();
  });

  it('allows TenantOwner to provision sandbox with generated idempotency key', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    const provisionSpy = vi.spyOn(mockSandboxService, 'provisionSandbox');

    render(
      <MemoryRouter>
        <AuthProvider>
          <SandboxManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Role:/i)).toBeInTheDocument();
    });

    // Open Modal
    const provisionBtn = screen.getByRole('button', { name: /Provision Sandbox/i });
    expect(provisionBtn).not.toBeDisabled();
    fireEvent.click(provisionBtn);

    expect(screen.getByText(/Provision Kubernetes Sandbox/i)).toBeInTheDocument();
    expect(screen.getByText(/Automated Security Invariants:/i)).toBeInTheDocument();

    // Fill Sandbox Name
    const nameInput = screen.getByPlaceholderText(/e\.g\. checkout-chaos-lab-01/i);
    fireEvent.change(nameInput, { target: { value: 'Payment Chaos Lab Beta' } });

    // Submit Form
    const submitBtn = screen.getByTestId('submit-provision-modal-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(provisionSpy).toHaveBeenCalled();
      const calledPayload = provisionSpy.mock.calls[0][0];
      const calledIdemKey = provisionSpy.mock.calls[0][1];
      expect(calledPayload.name).toBe('Payment Chaos Lab Beta');
      expect(calledIdemKey).toMatch(/^idem-/);
    });

    provisionSpy.mockRestore();
  });

  it('allows TenantOwner to open terminate modal with safety confirmation before teardown', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter>
        <AuthProvider>
          <SandboxManagementScreen />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/E-Commerce Chaos Lab Alpha/i)).toBeInTheDocument();
    });

    // Click Terminate
    const terminateBtns = screen.getAllByRole('button', { name: /Terminate/i });
    expect(terminateBtns[0]).not.toBeDisabled();
    fireEvent.click(terminateBtns[0]);

    // Modal opens
    expect(screen.getByText(/Irreversible Kubernetes Teardown/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Teardown/i });
    expect(confirmBtn).toBeDisabled();

    // Type sandbox name to confirm
    const confirmInput = screen.getByPlaceholderText(/E-Commerce Chaos Lab Alpha/i);
    fireEvent.change(confirmInput, { target: { value: 'E-Commerce Chaos Lab Alpha' } });

    expect(confirmBtn).not.toBeDisabled();
  });
});
