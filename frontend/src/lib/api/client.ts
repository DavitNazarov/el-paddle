export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function apiConnectionErrorMessage() {
  return `Could not reach the API at ${API_BASE_URL}. Start the backend with npm run dev:backend and try again.`;
}

export async function readApiJson<T>(response: Response, fallback: T) {
  try {
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

let csrfToken = '';

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(apiUrl('/api/auth/csrf'), { credentials: 'include', cache: 'no-store' });
  const data = response.ok ? await response.json() as { token?: string } : {};
  csrfToken = data.token ?? '';
  return csrfToken;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const method = (init.method ?? 'GET').toUpperCase();
  const token = ['GET', 'HEAD', 'OPTIONS'].includes(method) ? '' : await getCsrfToken();
  return fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { 'x-csrf-token': token } : {}),
      ...init.headers,
    },
  });
}

export function createCommandId(scope: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${random}`;
}
