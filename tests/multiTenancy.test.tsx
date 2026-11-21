import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ProjectSwitcher } from '../src/features/projects/ProjectSwitcher';
import { TenantSwitcher } from '../src/features/tenants/TenantSwitcher';

const TenantProjectInspector: React.FC = () => {
  const { activeTenant, activeProject, tenants, projects } = useAuth();
  return (
    <div>
      <div data-testid="active-tenant-name">{activeTenant?.name || 'none'}</div>
      <div data-testid="active-tenant-id">{activeTenant?.id || 'none'}</div>
      <div data-testid="active-project-name">{activeProject?.name || 'none'}</div>
      <div data-testid="active-project-id">{activeProject?.id || 'none'}</div>
      <div data-testid="tenants-count">{tenants.length}</div>
      <div data-testid="projects-count">{projects.length}</div>
      <div data-testid="projects-list">
        {projects.map((p) => p.name).join(',')}
      </div>
    </div>
  );
};

describe('Milestone M2: Multi-Tenancy Scoping & Isolation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-lead');
  });

  it('initializes with active tenant and active project scoped to that tenant', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TenantProjectInspector />
          <TenantSwitcher />
          <ProjectSwitcher />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tenant-name')).toHaveTextContent('Acme Corp Platform');
      expect(screen.getByTestId('active-tenant-id')).toHaveTextContent('c1f7b0f6-9304-4c57-897e-d309085ec617');
    });

    // Verify projects scoped to Acme Corp Platform
    expect(screen.getByTestId('projects-list')).toHaveTextContent('E-Commerce Checkout Resilience');
    expect(screen.getByTestId('projects-list')).toHaveTextContent('Core Payment Gateway Mesh');
    expect(screen.getByTestId('projects-list')).not.toHaveTextContent('Staging Mesh Canary');
  });

  it('switches active tenant and updates scoped projects list', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TenantProjectInspector />
          <TenantSwitcher />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tenant-name')).toHaveTextContent('Acme Corp Platform');
    });

    // Open Tenant dropdown
    const tenantTrigger = screen.getByRole('button', { name: /Acme Corp Platform/i });
    fireEvent.click(tenantTrigger);

    // Click on Acme SRE Lab
    const labOption = screen.getByText('Acme SRE Lab');
    fireEvent.click(labOption);

    await waitFor(() => {
      expect(screen.getByTestId('active-tenant-name')).toHaveTextContent('Acme SRE Lab');
      expect(screen.getByTestId('active-tenant-id')).toHaveTextContent('e22a59f6-0df7-45bf-90b5-772c918f8872');
    });

    // Verify projects are now scoped to Acme SRE Lab
    await waitFor(() => {
      expect(screen.getByTestId('projects-list')).toHaveTextContent('Staging Mesh Canary');
      expect(screen.getByTestId('projects-list')).not.toHaveTextContent('E-Commerce Checkout Resilience');
    });
  });

  it('switches active project within current tenant boundary', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TenantProjectInspector />
          <ProjectSwitcher />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-project-name')).toHaveTextContent('E-Commerce Checkout Resilience');
    });

    // Open Project dropdown
    const projectTrigger = screen.getByRole('button', { name: /E-Commerce Checkout Resilience/i });
    fireEvent.click(projectTrigger);

    // Select Core Payment Gateway Mesh
    const paymentsOption = screen.getByText('Core Payment Gateway Mesh');
    fireEvent.click(paymentsOption);

    await waitFor(() => {
      expect(screen.getByTestId('active-project-name')).toHaveTextContent('Core Payment Gateway Mesh');
      expect(screen.getByTestId('active-project-id')).toHaveTextContent('550e8400-e29b-41d4-a716-446655440001');
    });
  });

  it('creates new tenant organization and switches to it', async () => {
    const TenantCreationTester: React.FC = () => {
      const { createTenant } = useAuth();
      return (
        <button
          onClick={() => createTenant({ name: 'Fintech Division', slug: 'fintech-div' })}
        >
          Create Fintech Tenant
        </button>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <TenantProjectInspector />
          <TenantCreationTester />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tenant-name')).toHaveTextContent('Acme Corp Platform');
    });

    fireEvent.click(screen.getByText('Create Fintech Tenant'));

    await waitFor(() => {
      expect(screen.getByTestId('active-tenant-name')).toHaveTextContent('Fintech Division');
      expect(screen.getByTestId('tenants-count')).toHaveTextContent('3');
    });
  });
});
