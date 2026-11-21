import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import {
  canAdministerTenant,
  canApproveReports,
  canExecuteChaos,
  canManageIncidents,
  canManageProjects,
  canOperateSandboxes,
  canViewReports,
  hasPermission,
} from '../src/context/rbac';
import { ProtectedRoute } from '../src/features/auth/ProtectedRoute';
import { ChaosLabScreen } from '../src/components/ChaosLabScreen';
import { CLUSTERS, INITIAL_SERVICES } from '../src/services/mock/mockData';

describe('Milestone M2: Role-Based Access Control (RBAC)', () => {
  describe('RBAC Permission Matrix Unit Logic', () => {
    it('grants full operational and administrative permissions to TenantOwner', () => {
      expect(canAdministerTenant('TenantOwner')).toBe(true);
      expect(canManageProjects('TenantOwner')).toBe(true);
      expect(canOperateSandboxes('TenantOwner')).toBe(true);
      expect(canExecuteChaos('TenantOwner')).toBe(true);
      expect(canManageIncidents('TenantOwner')).toBe(true);
      expect(canViewReports('TenantOwner')).toBe(true);
      expect(canApproveReports('TenantOwner')).toBe(true);
      expect(hasPermission('TenantOwner', 'audit:view')).toBe(true);
    });

    it('grants operational but not administrative permissions to Engineer', () => {
      expect(canAdministerTenant('Engineer')).toBe(false); // cannot manage org / create tenant
      expect(canManageProjects('Engineer')).toBe(true); // can manage projects
      expect(canOperateSandboxes('Engineer')).toBe(true);
      expect(canExecuteChaos('Engineer')).toBe(true);
      expect(canManageIncidents('Engineer')).toBe(true);
      expect(canViewReports('Engineer')).toBe(true);
      expect(canApproveReports('Engineer')).toBe(false); // cannot sign-off reports
    });

    it('strictly confines Viewer to read-only capabilities', () => {
      expect(canAdministerTenant('Viewer')).toBe(false);
      expect(canManageProjects('Viewer')).toBe(false);
      expect(canOperateSandboxes('Viewer')).toBe(false);
      expect(canExecuteChaos('Viewer')).toBe(false); // chaos execution blocked
      expect(canManageIncidents('Viewer')).toBe(false);
      expect(canViewReports('Viewer')).toBe(true); // can read reports
      expect(canApproveReports('Viewer')).toBe(false);
    });

    it('denies all permissions for undefined / anonymous roles', () => {
      expect(canAdministerTenant(undefined)).toBe(false);
      expect(canExecuteChaos(undefined)).toBe(false);
      expect(canManageProjects(undefined)).toBe(false);
      expect(canViewReports(undefined)).toBe(false);
    });
  });

  describe('ProtectedRoute Role & Permission Enforcement', () => {
    it('blocks access and displays 403 screen when role lacks required permission', async () => {
      sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-viewer');
      sessionStorage.setItem('chaos_user_email', 'auditor.compliance@acme.com'); // Viewer role
      render(
        <MemoryRouter>
          <AuthProvider>
            <ProtectedRoute requiredPermission="chaos:execute">
              <div>Top Secret Chaos Control Room</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Insufficient Role Permissions')).toBeInTheDocument();
        expect(screen.getByText(/chaos:execute/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Top Secret Chaos Control Room')).not.toBeInTheDocument();
    });

    it('allows access when user possesses required role or permission', async () => {
      sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-lead');
      sessionStorage.setItem('chaos_user_email', 'sre.lead@acme.com'); // TenantOwner
      render(
        <MemoryRouter>
          <AuthProvider>
            <ProtectedRoute requiredPermission="chaos:execute">
              <div>Authorized Chaos Control Room</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Authorized Chaos Control Room')).toBeInTheDocument();
      });
    });
  });

  describe('UI Component Role-Aware Disabling', () => {
    it('disables Launch button and displays Read-Only notice in ChaosLabScreen for Viewer', async () => {
      sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-viewer');
      sessionStorage.setItem('chaos_user_email', 'auditor.compliance@acme.com'); // Viewer role

      render(
        <MemoryRouter>
          <AuthProvider>
            <ChaosLabScreen
              cluster={CLUSTERS[0].id}
              services={INITIAL_SERVICES}
              experiments={[]}
              onLaunchExperiment={() => {}}
              onHaltExperiment={() => {}}
              onInspectService={() => {}}
            />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Viewer Role is read-only/i)).toBeInTheDocument();
        expect(screen.getByText(/Launch Restricted \(Read-Only\)/i)).toBeInTheDocument();
      });
    });
  });
});
