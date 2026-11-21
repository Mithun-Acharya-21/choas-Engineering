import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import { TelemetryProvider } from '../src/context/TelemetryContext';
import { AppRoutes } from '../src/routes';

describe('Navigation & Route Rendering', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-sre');
  });

  it('renders the telemetry overview screen on root route when authenticated', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sandbox Telemetry')).toBeInTheDocument();
    });
    expect(screen.getByText('ISOLATED SANDBOX')).toBeInTheDocument();
  });

  it('renders the chaos fault lab on /chaos route', async () => {
    render(
      <MemoryRouter initialEntries={['/chaos']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Chaos Fault Lab')).toBeInTheDocument();
    });
    expect(screen.getByText('SANDBOX RESTRICTED')).toBeInTheDocument();
  });

  it('renders the service mesh topology on /topology route', async () => {
    render(
      <MemoryRouter initialEntries={['/topology']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Service Mesh Topology')).toBeInTheDocument();
    });
    expect(screen.getAllByText('SANDBOX ISOLATED').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the incident log streams on /logs route', async () => {
    render(
      <MemoryRouter initialEntries={['/logs']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Incident & Chaos Log Streams')).toBeInTheDocument();
    });
    expect(screen.getByText('SAMPLE STREAM')).toBeInTheDocument();
  });

  it('renders dynamic sandbox provisioning screen on /sandboxes route', async () => {
    render(
      <MemoryRouter initialEntries={['/sandboxes']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dynamic Kubernetes Sandboxes')).toBeInTheDocument();
    });
  });

  it('renders incident detection screen on /incidents route', async () => {
    render(
      <MemoryRouter initialEntries={['/incidents']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Automated Incident Detection & Triage')).toBeInTheDocument();
      expect(screen.getByText('M7 Engine Active')).toBeInTheDocument();
    });
  });

  it('renders Postmortem Workspace for /reports route in Milestone M9', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Milestone M9 Active/i)).toBeInTheDocument();
      expect(screen.getAllByText(/payment-service/i)[0]).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login', async () => {
    sessionStorage.clear(); // unauthenticated
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <TelemetryProvider>
            <AppRoutes />
          </TelemetryProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Corporate Email Address')).toBeInTheDocument();
      expect(screen.getByText('Authenticate Session')).toBeInTheDocument();
    });
  });
});
