import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../services/api/apiClient';
import { authService, RegisterPayload } from '../services/api/authService';
import { projectService } from '../services/api/projectService';
import { mockAuthService } from '../services/mock/mockAuthService';
import { Project, Tenant, TenantRole, User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeTenant: Tenant | null;
  activeProject: Project | null;
  tenants: Tenant[];
  projects: Project[];
  role: TenantRole | undefined;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  selectTenant: (tenantId: string) => Promise<void>;
  createTenant: (payload: { name: string; slug: string }) => Promise<Tenant>;
  selectProject: (projectId: string) => void;
  createProject: (payload: { name: string; slug: string; description?: string }) => Promise<Project>;
  isMockMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'chaos_session_token';
const USER_EMAIL_KEY = 'chaos_user_email';
const ACTIVE_TENANT_KEY = 'chaos_active_tenant_id';
const ACTIVE_PROJECT_KEY = 'chaos_active_project_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const isMockMode = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

  // Wire ApiClient token & tenant providers
  useEffect(() => {
    apiClient.setTokenProvider(() => token);
  }, [token]);

  useEffect(() => {
    apiClient.setTenantProvider(() => activeTenant?.id || null);
  }, [activeTenant]);

  const loadProjectsForTenant = useCallback(async (tenantId: string) => {
    try {
      if (isMockMode) {
        const res = await mockAuthService.listProjects(tenantId);
        setProjects(res.items);
        return res.items;
      } else {
        const res = await projectService.listProjects();
        setProjects(res.items);
        return res.items;
      }
    } catch {
      setProjects([]);
      return [];
    }
  }, [isMockMode]);

  // Session restoration on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = sessionStorage.getItem(SESSION_KEY);
        if (!savedToken) {
          setIsLoading(false);
          return;
        }

        if (isMockMode) {
          // In mock mode, restore based on saved email or default SRE user
          const emailToRestore = sessionStorage.getItem(USER_EMAIL_KEY) || 'sre.lead@acme.com';
          const mockUser = (await mockAuthService.login(emailToRestore, 'SecurePassword123!')).user;
          const tenantList = (await mockAuthService.listTenants()).items;
          setTenants(tenantList);

          const savedTenantId = sessionStorage.getItem(ACTIVE_TENANT_KEY) || mockUser.active_tenant_id;
          const tenant = tenantList.find((t) => t.id === savedTenantId) || tenantList[0];
          setActiveTenant(tenant);

          const projectList = await mockAuthService.listProjects(tenant.id);
          setProjects(projectList.items);

          const savedProjectId = sessionStorage.getItem(ACTIVE_PROJECT_KEY);
          const proj = projectList.items.find((p) => p.id === savedProjectId) || projectList.items[0] || null;
          setActiveProject(proj);

          setUser({
            id: mockUser.id,
            email: mockUser.email,
            fullName: mockUser.full_name,
            isActive: true,
            isSuperuser: false,
            activeTenantId: tenant.id,
            role: (mockUser.role as TenantRole) || 'TenantOwner',
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-01T00:00:00Z',
          });
          setToken(savedToken);
        } else {
          // Live mode: call refresh token endpoint
          const res = await authService.refreshToken();
          setToken(res.access_token);
          sessionStorage.setItem(SESSION_KEY, res.access_token);

          const tenantRes = await authService.listTenants();
          setTenants(tenantRes.items);
          if (tenantRes.items.length > 0) {
            const savedTenantId = sessionStorage.getItem(ACTIVE_TENANT_KEY);
            const tenant = tenantRes.items.find((t) => t.id === savedTenantId) || tenantRes.items[0];
            setActiveTenant(tenant);
            await loadProjectsForTenant(tenant.id);
          }
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [isMockMode, loadProjectsForTenant]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(USER_EMAIL_KEY);
    sessionStorage.removeItem(ACTIVE_TENANT_KEY);
    sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
    setToken(null);
    setUser(null);
    setActiveTenant(null);
    setActiveProject(null);
    setTenants([]);
    setProjects([]);
  }, []);

  // Configure 401 callback on ApiClient
  useEffect(() => {
    apiClient.setOnUnauthorized(logout);
  }, [logout]);

  const login = useCallback(
    async (username: string, password: string) => {
      setIsLoading(true);
      try {
        let authRes: {
          access_token: string;
          user: { id: string; email: string; full_name: string; active_tenant_id: string; role: string };
        };

        if (isMockMode) {
          authRes = await mockAuthService.login(username, password);
        } else {
          authRes = await authService.login(username, password);
        }

        setToken(authRes.access_token);
        sessionStorage.setItem(SESSION_KEY, authRes.access_token);
        sessionStorage.setItem(USER_EMAIL_KEY, authRes.user.email);

        // Fetch tenants
        const tenantList = isMockMode
          ? (await mockAuthService.listTenants()).items
          : (await authService.listTenants()).items;
        setTenants(tenantList);

        const currentTenant =
          tenantList.find((t) => t.id === authRes.user.active_tenant_id) || tenantList[0] || null;
        setActiveTenant(currentTenant);
        if (currentTenant) {
          sessionStorage.setItem(ACTIVE_TENANT_KEY, currentTenant.id);
          const projectList = await loadProjectsForTenant(currentTenant.id);
          if (projectList.length > 0) {
            setActiveProject(projectList[0]);
            sessionStorage.setItem(ACTIVE_PROJECT_KEY, projectList[0].id);
          }
        }

        setUser({
          id: authRes.user.id,
          email: authRes.user.email,
          fullName: authRes.user.full_name,
          isActive: true,
          isSuperuser: false,
          activeTenantId: currentTenant?.id,
          role: (authRes.user.role as TenantRole) || 'TenantOwner',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isMockMode, loadProjectsForTenant]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setIsLoading(true);
      try {
        if (isMockMode) {
          await mockAuthService.register(payload);
        } else {
          await authService.register(payload);
        }
        // Auto-login after successful registration
        await login(payload.email, payload.password);
      } finally {
        setIsLoading(false);
      }
    },
    [isMockMode, login]
  );

  const selectTenant = useCallback(
    async (tenantId: string) => {
      const selected = tenants.find((t) => t.id === tenantId);
      if (!selected) return;

      setActiveTenant(selected);
      sessionStorage.setItem(ACTIVE_TENANT_KEY, selected.id);

      // Reload projects for newly selected tenant
      const projs = await loadProjectsForTenant(selected.id);
      const nextProj = projs[0] || null;
      setActiveProject(nextProj);
      if (nextProj) {
        sessionStorage.setItem(ACTIVE_PROJECT_KEY, nextProj.id);
      } else {
        sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
      }

      // Update user activeTenantId
      if (user) {
        setUser({ ...user, activeTenantId: selected.id, role: selected.role || user.role });
      }
    },
    [tenants, loadProjectsForTenant, user]
  );

  const createTenant = useCallback(
    async (payload: { name: string; slug: string }): Promise<Tenant> => {
      const newTenant = isMockMode
        ? await mockAuthService.createTenant(payload)
        : await authService.createTenant(payload);

      setTenants((prev) => [...prev, newTenant]);
      setActiveTenant(newTenant);
      sessionStorage.setItem(ACTIVE_TENANT_KEY, newTenant.id);

      const projs = await loadProjectsForTenant(newTenant.id);
      setActiveProject(projs[0] || null);
      if (projs[0]) {
        sessionStorage.setItem(ACTIVE_PROJECT_KEY, projs[0].id);
      } else {
        sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
      }

      if (user) {
        setUser({ ...user, activeTenantId: newTenant.id, role: newTenant.role || user.role });
      }

      return newTenant;
    },
    [isMockMode, loadProjectsForTenant, user]
  );

  const selectProject = useCallback(
    (projectId: string) => {
      const selected = projects.find((p) => p.id === projectId);
      if (selected) {
        setActiveProject(selected);
        sessionStorage.setItem(ACTIVE_PROJECT_KEY, selected.id);
      }
    },
    [projects]
  );

  const createProject = useCallback(
    async (payload: { name: string; slug: string; description?: string }): Promise<Project> => {
      if (!activeTenant) throw new Error('No active tenant selected.');

      const newProj = isMockMode
        ? await mockAuthService.createProject(activeTenant.id, payload)
        : await projectService.createProject(payload);

      setProjects((prev) => [newProj, ...prev]);
      setActiveProject(newProj);
      sessionStorage.setItem(ACTIVE_PROJECT_KEY, newProj.id);
      return newProj;
    },
    [activeTenant, isMockMode]
  );

  const role = user?.role || activeTenant?.role || 'Viewer';

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      activeTenant,
      activeProject,
      tenants,
      projects,
      role,
      login,
      register,
      logout,
      selectTenant,
      createTenant,
      selectProject,
      createProject,
      isMockMode,
    }),
    [
      user,
      token,
      isLoading,
      activeTenant,
      activeProject,
      tenants,
      projects,
      role,
      login,
      register,
      logout,
      selectTenant,
      createTenant,
      selectProject,
      createProject,
      isMockMode,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
