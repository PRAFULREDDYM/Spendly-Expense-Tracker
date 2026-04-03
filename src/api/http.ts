import type { ApiErrorShape } from '../types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code = 'api_error', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ResponseType = 'json' | 'text' | 'blob';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>;
  responseType?: ResponseType;
}

const DEFAULT_API_BASE_URL = '/api';

export function getApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return (envBaseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function appendParam(searchParams: URLSearchParams, key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return;

  if (Array.isArray(value)) {
    value.forEach((item) => appendParam(searchParams, key, item));
    return;
  }

  searchParams.append(key, String(value));
}

export function buildUrl(path: string, params?: RequestOptions['params']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(`${getApiBaseUrl()}${normalizedPath}`, origin);

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => appendParam(searchParams, key, value));
    searchParams.forEach((value, key) => url.searchParams.append(key, value));
  }

  return url.toString();
}

let refreshPromise: Promise<boolean> | null = null;

function shouldSkipRefresh(path: string) {
  return ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'].some((suffix) =>
    path.endsWith(suffix),
  );
}

async function tryRefreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        accept: 'application/json',
      },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  const isFormData = typeof FormData !== 'undefined' && value instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && value instanceof Blob;
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isFormData && !isBlob;
}

async function parseApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as ApiErrorShape;
      const error = payload?.error;
      return new ApiError(error?.message || response.statusText, response.status, error?.code, error?.details);
    }

    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as ApiErrorShape;
        const error = parsed?.error;
        if (error) {
          return new ApiError(error.message || response.statusText, response.status, error.code, error.details);
        }
      } catch {
        // Fall back to a plain-text error below.
      }
      return new ApiError(text, response.status);
    }
  } catch {
    // Fall through to the default error below.
  }

  return new ApiError(response.statusText || 'Request failed', response.status);
}

async function performRequest<TResponse>(
  path: string,
  options: RequestOptions,
  retryAfterRefresh: boolean,
): Promise<TResponse> {
  const { body, params, responseType = 'json', headers, ...init } = options;
  const url = buildUrl(path, params);
  const nextHeaders = new Headers(headers);

  if (body !== undefined && !nextHeaders.has('content-type') && isPlainObject(body)) {
    nextHeaders.set('content-type', 'application/json');
  }

  if (!nextHeaders.has('accept') && responseType === 'json') {
    nextHeaders.set('accept', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers: nextHeaders,
    credentials: 'include',
    body:
      (typeof FormData !== 'undefined' && body instanceof FormData) ||
      (typeof Blob !== 'undefined' && body instanceof Blob) ||
      typeof body === 'string'
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
  });

  if (response.status === 401 && !retryAfterRefresh && !shouldSkipRefresh(path)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return performRequest(path, options, true);
    }
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  if (responseType === 'text') {
    return (await response.text()) as TResponse;
  }

  if (responseType === 'blob') {
    return (await response.blob()) as TResponse;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return (await response.text()) as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  return performRequest(path, options, false);
}
