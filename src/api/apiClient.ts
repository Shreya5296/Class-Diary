import { generateRequestId } from './requestId';
import { ApiResponse } from './apiResponse';
import { ApiClientError, ApiNetworkError } from './apiErrors';
import { getRuntimeConfig } from '../config/runtimeConfig';
import { handleMockApiRequest } from './mockDataStore';

export interface RequestOptions {
  token?: string | null;
  requestId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
}

const inFlightMap = new Map<string, Promise<ApiResponse<any>>>();

function isReadOnlyOp(op: string, idempKey?: string): boolean {
  if (idempKey) return false;
  return op.endsWith('.list') || op.endsWith('.get') || op.endsWith('.overview') || op.endsWith('.getBalance');
}

export async function sendApiRequest<T = unknown>(
  operation: string,
  payload: Record<string, unknown> = {},
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const config = getRuntimeConfig();
  const url = config.appsScriptUrl;
  const requestId = options.requestId || generateRequestId();
  const idempKey = options.idempotencyKey || (payload.idempotency_key as string | undefined) || undefined;

  if (config.useMockData) {
    return handleMockApiRequest<T>(operation, payload, requestId);
  }

  const isDedupe = isReadOnlyOp(operation, idempKey);
  const cacheKey = isDedupe ? `${operation}:${JSON.stringify(payload)}:${options.token || ''}` : '';

  if (isDedupe && inFlightMap.has(cacheKey)) {
    return inFlightMap.get(cacheKey) as Promise<ApiResponse<T>>;
  }

  const bodyData = {
    apiVersion: '1',
    operation,
    token: options.token || undefined,
    identityToken: options.token || undefined,
    idempotencyKey: idempKey,
    requestId,
    data: payload,
    payload: payload,
  };

  if (!url) {
    throw new ApiClientError({
      code: 'CONFIGURATION_ERROR',
      message: 'Apps Script API URL is not configured. Set VITE_APPS_SCRIPT_URL.',
    }, requestId);
  }

  const exec = async (): Promise<ApiResponse<T>> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 60000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(bodyData),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiNetworkError(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      let json: ApiResponse<T>;
      try {
        json = await response.json();
      } catch {
        throw new ApiNetworkError('Backend returned invalid response (HTML or non-JSON)');
      }

      if (!json.ok && json.error) {
        throw new ApiClientError(json.error, json.meta?.requestId || requestId);
      }
      return json;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiClientError || err instanceof ApiNetworkError) throw err;
      if ((err as Error)?.name === 'AbortError') {
        const sec = Math.round((options.timeoutMs || 60000) / 1000);
        throw new ApiNetworkError(`Request timed out after ${sec}s`);
      }
      const rawMsg = (err as Error)?.message || '';
      throw new ApiNetworkError(rawMsg ? `Network request failed: ${rawMsg}` : 'Network request failed', err);
    } finally {
      if (isDedupe) inFlightMap.delete(cacheKey);
    }
  };

  const promise = exec();
  if (isDedupe) inFlightMap.set(cacheKey, promise);
  return promise;
}
