import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LoginPage } from '../src/features/auth/LoginPage';
import { RegisterPage } from '../src/features/auth/RegisterPage';

// Helper component to inspect AuthContext state
const AuthInspector: React.FC = () => {
  const { user, token, isAuthenticated, role, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <div data-testid="user-role">{role || 'none'}</div>
      <div data-testid="auth-token">{token || 'none'}</div>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
};

describe('Milestone M2: Authentication Architecture & UI Flows', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('authenticates user successfully with valid credentials and sets session token', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
          <AuthInspector />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });

    const submitBtn = screen.getByText('Authenticate Session');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('sre.lead@acme.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('TenantOwner');
    });

    expect(sessionStorage.getItem('chaos_session_token')).toBeTruthy();
  });

  it('rejects authentication with invalid credentials and displays error alert', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText('Corporate Email Address');
    const passwordInput = screen.getByLabelText('Password');

    fireEvent.change(emailInput, { target: { value: 'sre.lead@acme.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword!' } });

    const submitBtn = screen.getByText('Authenticate Session');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  it('restores authenticated session on mount from sessionStorage', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-lead');

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthInspector />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('sre.lead@acme.com');
    });
  });

  it('clears session and tokens on logout', async () => {
    sessionStorage.setItem('chaos_session_token', 'mock-jwt-token-lead');

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthInspector />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    fireEvent.click(screen.getByTestId('logout-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('none');
    });

    expect(sessionStorage.getItem('chaos_session_token')).toBeNull();
  });

  it('validates password length requirement (>= 10 chars per FR-001) during registration', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const fullNameInput = screen.getByLabelText('Full Name');
    const emailInput = screen.getByLabelText('Corporate Email Address');
    const tenantInput = screen.getByLabelText('Organization / Tenant Name');
    const passwordInput = screen.getByLabelText(/Password/i);

    fireEvent.change(fullNameInput, { target: { value: 'Test Engineer' } });
    fireEvent.change(emailInput, { target: { value: 'test@acme.com' } });
    fireEvent.change(tenantInput, { target: { value: 'Acme Test Corp' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } }); // < 10 chars

    fireEvent.click(screen.getByText('Register Workspace & Login'));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 10 characters long.')).toBeInTheDocument();
    });
  });
});
