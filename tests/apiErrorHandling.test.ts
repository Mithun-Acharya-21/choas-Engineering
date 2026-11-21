import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/services/api/apiClient';

describe('ApiClient & Error Handling', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('/api/v1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects Bearer token if token provider is configured', async () => {
    client.setTokenProvider(() => 'test-jwt-token-xyz');

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    await client.get('/test-endpoint');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/test-endpoint',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token-xyz',
        }),
      })
    );
  });

  it('throws ApiError with status and RFC 7807 problem details on 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        type: 'https://api.chaosengine.io/errors/RESOURCE_NOT_FOUND',
        title: 'Resource Not Found',
        status: 404,
        detail: 'Sandbox sbx-123 does not exist',
        code: 'ERR_SANDBOX_NOT_FOUND',
      }),
    } as Response);

    await expect(client.get('/sandboxes/sbx-123')).rejects.toThrow(ApiError);

    try {
      await client.get('/sandboxes/sbx-123');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe('ERR_SANDBOX_NOT_FOUND');
      expect(apiErr.details?.detail).toBe('Sandbox sbx-123 does not exist');
    }
  });

  it('handles network failure gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

    await expect(client.get('/health')).rejects.toThrow('Connection refused');
  });
});
