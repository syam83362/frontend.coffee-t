// Single HTTP client for the Coffee-T API: cookies, CSRF, timeouts, error
// normalisation and transparent access-token refresh all live here.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

const REQUEST_TIMEOUT_MS = 15_000;

export type Role = 'customer' | 'admin' | 'cafe_manager' | 'waiter';

export interface Account {
  id: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  user: Account;
  csrfToken: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  /** Attempt one silent session refresh when the API answers 401. Defaults to true. */
  refreshOn401?: boolean;
  signal?: AbortSignal;
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let refreshRequest: Promise<Account | null> | null = null;
const sessionListeners = new Set<(user: Account | null) => void>();

export function onSessionChange(listener: (user: Account | null) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function emitSession(user: Account | null): void {
  sessionListeners.forEach((listener) => listener(user));
}

export function rememberCsrfToken(token: string): void {
  csrfToken = token;
}

export async function getCsrfToken(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  csrfRequest ??= send<{ csrfToken: string }>('/auth/csrf', { method: 'GET' })
    .then((result) => {
      csrfToken = result.csrfToken;
      return result.csrfToken;
    })
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

/** Exchanges the refresh cookie for a new access cookie. Concurrent callers share one request. */
export function refreshSession(): Promise<Account | null> {
  refreshRequest ??= (async () => {
    try {
      const result = await apiRequest<AuthResponse>('/auth/refresh', { method: 'POST', refreshOn401: false });
      csrfToken = result.csrfToken;
      emitSession(result.user);
      return result.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Another tab may have rotated the refresh token a moment ago and already stored
        // fresh cookies; if so the session is still valid.
        try {
          const current = await send<{ user: Account }>('/auth/me', { method: 'GET' });
          await getCsrfToken(true);
          emitSession(current.user);
          return current.user;
        } catch {
          csrfToken = null;
          emitSession(null);
          return null;
        }
      }
      throw error;
    } finally {
      refreshRequest = null;
    }
  })();
  return refreshRequest;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const mutating = method !== 'GET';
  const refreshOn401 = options.refreshOn401 ?? true;

  const attempt = async (canRetryCsrf: boolean, canRefresh: boolean): Promise<T> => {
    const headers: Record<string, string> = { ...options.headers };
    if (mutating) headers['X-CSRF-Token'] = await getCsrfToken();
    try {
      return await send<T>(path, { method, headers, body: options.body, signal: options.signal });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 401 && canRefresh && refreshOn401) {
        const user = await refreshSession();
        if (user) return attempt(canRetryCsrf, false);
      }
      // The CSRF context rotates on login/refresh (possibly in another tab); fetch a fresh token once.
      if (error.status === 403 && mutating && canRetryCsrf) {
        await getCsrfToken(true);
        return attempt(false, canRefresh);
      }
      throw error;
    }
  };

  return attempt(true, true);
}

async function send<T>(
  path: string,
  options: { method: Method; headers?: Record<string, string>; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('The server took too long to respond. Please try again.', 0);
    }
    throw new ApiError('We could not reach Coffee-T. Check your connection and try again.', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(readErrorMessage(payload, response.status), response.status);
  return payload as T;
}

function readErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const { message } = payload;
    if (Array.isArray(message) && message.length) return message.map(String).join('. ');
    if (typeof message === 'string' && message) return message;
  }
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return 'You do not have access to do that.';
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again shortly.';
  return 'The request could not be completed.';
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
