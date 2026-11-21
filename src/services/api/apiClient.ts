export interface ApiErrorDetails {
  type?: string;
  title: string;
  status: number;
  detail: string;
  code?: string;
}

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: ApiErrorDetails;

  constructor(message: string, status: number, details?: ApiErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = details?.code;
    this.details = details;
  }
}

export class ApiClient {
  private baseUrl: string;
  private tokenProvider: (() => string | null) | null = null;
  private tenantProvider: (() => string | null) | null = null;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';
  }

  public setTokenProvider(provider: () => string | null) {
    this.tokenProvider = provider;
  }

  public setTenantProvider(provider: () => string | null) {
    this.tenantProvider = provider;
  }

  public setOnUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.tokenProvider) {
      const token = this.tokenProvider();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    if (this.tenantProvider) {
      const tenantId = this.tenantProvider();
      if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
      }
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = { ...this.getHeaders(), ...(options.headers as Record<string, string>) };

    try {
      const res = await fetch(url, { ...options, headers });

      if (res.status === 401 && this.onUnauthorizedCallback) {
        this.onUnauthorizedCallback();
      }

      if (!res.ok) {
        let details: ApiErrorDetails | undefined;
        try {
          details = (await res.json()) as ApiErrorDetails;
        } catch {
          // Response body was not JSON
        }
        throw new ApiError(
          details?.detail || `API Request failed with status ${res.status}`,
          res.status,
          details
        );
      }

      // Handle 204 No Content
      if (res.status === 204) {
        return {} as T;
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(err instanceof Error ? err.message : 'Network request failed', 0);
    }
  }

  public get<T>(endpoint: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = endpoint;
    if (queryParams) {
      const sp = new URLSearchParams();
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v !== undefined) sp.append(k, String(v));
      });
      const qs = sp.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public post<T>(endpoint: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
