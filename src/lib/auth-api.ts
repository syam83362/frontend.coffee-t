const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Account {
  id: string;
  email: string;
  role: 'customer' | 'admin' | 'cafe_manager' | 'waiter';
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

export async function getCsrfToken(): Promise<string> {
  const result = await request<{ csrfToken: string }>('/auth/csrf', { method: 'GET' });
  return result.csrfToken;
}

export function register(email: string, password: string, csrfToken: string): Promise<AuthResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    csrfToken,
  });
}

export function login(email: string, password: string, csrfToken: string): Promise<AuthResponse> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    csrfToken,
  });
}

export function refreshSession(csrfToken: string): Promise<AuthResponse> {
  return request('/auth/refresh', { method: 'POST', csrfToken });
}

export async function logout(csrfToken: string): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST', csrfToken });
}

export function getCurrentUser(): Promise<{ user: Account }> {
  return request('/auth/me', { method: 'GET' });
}

async function request<T>(
  path: string,
  options: {
    method: 'GET' | 'POST';
    body?: string;
    csrfToken?: string;
  },
): Promise<T> {
  const headers = new Headers();
  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.csrfToken) {
    headers.set('X-CSRF-Token', options.csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body,
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('The Coffee-T API did not respond. Check that the backend is running on port 3001.', 0);
    }
    throw new ApiError('Cannot reach the Coffee-T API. Check that the backend is running on port 3001.', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload), response.status);
  }
  return payload as T;
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('message' in payload)) {
    return 'The request could not be completed.';
  }

  const message = payload.message;
  if (Array.isArray(message)) {
    return message.join(' ');
  }
  return typeof message === 'string' ? message : 'The request could not be completed.';
}