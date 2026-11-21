import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import { InteractiveTopologyEditor } from '../src/features/topology/InteractiveTopologyEditor';
import { mockTopologyService } from '../src/services/mock/mockTopologyService';

describe('Milestone M4: Interactive Service Topology Editor UI', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders interactive topology canvas with toolbar, nodes, and validation badge', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter>
        <AuthProvider>
          <InteractiveTopologyEditor />
        </AuthProvider>
      </MemoryRouter>
    );

    // Canvas headers & indicators
    expect(screen.getByText('Service Mesh Topology')).toBeInTheDocument();
    expect(screen.getByText('SANDBOX ISOLATED')).toBeInTheDocument();

    // Node palette buttons for Engineer/Owner
    await waitFor(() => {
      expect(screen.getByTestId('add-service-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-gateway-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-postgres-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-redis-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-external-btn')).toBeInTheDocument();
    });

    // Validation status button
    await waitFor(() => {
      expect(screen.getByTestId('validation-status-btn')).toBeInTheDocument();
      expect(screen.getByText(/Graph Valid/i)).toBeInTheDocument();
    });

    // Zero-YAML security callout
    expect(screen.getByText(/Zero-YAML Direct Deployment/i)).toBeInTheDocument();
  });

  it('allows adding a new service node to the canvas', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter>
        <AuthProvider>
          <InteractiveTopologyEditor />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Service Mesh Topology')).toBeInTheDocument();
      expect(screen.getByTestId('add-postgres-btn')).toBeInTheDocument();
    });

    // Add a Postgres node
    const addPgBtn = screen.getByTestId('add-postgres-btn');
    fireEvent.click(addPgBtn);

    // Verify UNSAVED badge appears
    await waitFor(() => {
      expect(screen.getByText('UNSAVED')).toBeInTheDocument();
    });
  });

  it('opens and closes the validation drawer displaying graph checks and cycle semantics', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter>
        <AuthProvider>
          <InteractiveTopologyEditor />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Graph Valid/i)).toBeInTheDocument();
      expect(screen.getByText(/v\d+/)).toBeInTheDocument();
    });

    // Click validation button
    const valBtn = screen.getByText(/Graph Valid/i);
    fireEvent.click(valBtn);

    // Drawer should open
    await waitFor(() => {
      expect(screen.getByText('Topology Validation Engine')).toBeInTheDocument();
      expect(screen.getByText('READY FOR DEPLOYMENT')).toBeInTheDocument();
      expect(screen.getByText(/Structural Errors/i)).toBeInTheDocument();
      expect(screen.getByText(/Architectural Advisories/i)).toBeInTheDocument();
    });

    // Close validation drawer
    const closeBtn = screen.getByRole('button', { name: /Close Validation/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Topology Validation Engine')).not.toBeInTheDocument();
    });
  });

  it('opens version history modal and lists snapshot versions', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');

    render(
      <MemoryRouter>
        <AuthProvider>
          <InteractiveTopologyEditor />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Service Mesh Topology')).toBeInTheDocument();
      expect(screen.getByText(/v\d+/)).toBeInTheDocument();
    });

    // Click History button
    const historyBtn = screen.getByTitle(/Inspect version history and snapshots/i);
    fireEvent.click(historyBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Topology Version History')).toBeInTheDocument();
      expect(screen.getByText('CURRENT')).toBeInTheDocument();
    });

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Topology Version History')).not.toBeInTheDocument();
    });
  });

  it('saves topology changes and triggers optimistic concurrency update', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    const updateSpy = vi.spyOn(mockTopologyService, 'updateTopology');

    render(
      <MemoryRouter>
        <AuthProvider>
          <InteractiveTopologyEditor />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Service Mesh Topology')).toBeInTheDocument();
      expect(screen.getByText(/v\d+/)).toBeInTheDocument();
      expect(screen.getByTestId('add-service-btn')).toBeInTheDocument();
    });

    // Add node to trigger unsaved state
    const addSvcBtn = screen.getByTestId('add-service-btn');
    fireEvent.click(addSvcBtn);

    const saveBtn = screen.getByTestId('save-topology-btn');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
      const callPayload = updateSpy.mock.calls[0][1];
      expect(callPayload.expectedVersion).toBe(1);
    });

    updateSpy.mockRestore();
  });

  it('opens deploy modal and allows deploying validated topology into a sandbox', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
    const deploySpy = vi.spyOn(mockTopologyService, 'deployTopology');

    render(
      <MemoryRouter>
        <AuthProvider>
          <InteractiveTopologyEditor />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Graph Valid/i)).toBeInTheDocument();
      expect(screen.getByText(/v\d+/)).toBeInTheDocument();
    });

    // Open Deploy Modal
    const deployBtn = screen.getByTestId('deploy-topology-btn');
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(screen.getByText('Deploy Topology to Sandbox')).toBeInTheDocument();
      expect(screen.getByText(/Target Kubernetes Sandbox/i)).toBeInTheDocument();
    });

    // Submit deployment
    const confirmDeployBtn = screen.getByRole('button', { name: /^Deploy Topology$/i });
    fireEvent.click(confirmDeployBtn);

    await waitFor(() => {
      expect(deploySpy).toHaveBeenCalled();
    }, { timeout: 8000 });

    deploySpy.mockRestore();
  }, 15000);

  it('enforces RBAC restrictions: Viewer has VIEW ONLY mode and cannot edit or deploy', async () => {
    // Unauthenticated/Viewer role
    render(
      <MemoryRouter>
        <AuthProvider>
          <InteractiveTopologyEditor />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('VIEW ONLY')).toBeInTheDocument();
    });

    // Palette buttons hidden for Viewer
    expect(screen.queryByTestId('add-service-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('save-topology-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deploy-topology-btn')).not.toBeInTheDocument();
  });
});
