import { Account, apiRequest, AuthResponse, getCsrfToken, rememberCsrfToken } from './api';

export type { Account, AuthResponse } from './api';
export { ApiError } from './api';

export async function register(email: string, password: string): Promise<Account> {
  const result = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password },
    refreshOn401: false,
  });
  rememberCsrfToken(result.csrfToken);
  return result.user;
}

export async function login(email: string, password: string): Promise<Account> {
  const result = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    refreshOn401: false,
  });
  rememberCsrfToken(result.csrfToken);
  return result.user;
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST', refreshOn401: false });
  await getCsrfToken(true);
}

export async function getCurrentUser(): Promise<Account> {
  const result = await apiRequest<{ user: Account }>('/auth/me');
  return result.user;
}
