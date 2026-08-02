import { clearSession, loadSession } from '../auth/session';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

function authHeader(): Record<string, string> {
  const token = loadSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(response: Response) {
  if (response.status === 401) {
    clearSession();
    window.location.assign('/login');
  }
}

/** Nest's default error body is {statusCode, message, error} — message can be a string or (class-validator) a string[]. Falls back to a generic message if the body isn't JSON or doesn't match. */
async function extractErrorMessage(response: Response, path: string): Promise<string> {
  try {
    const body: unknown = await response.clone().json();
    const message = (body as { message?: string | string[] })?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  } catch {
    // not JSON, fall through
  }
  return `Request failed: ${response.status} ${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    ...options,
  });
  if (!response.ok) {
    handleUnauthorized(response);
    throw new Error(await extractErrorMessage(response, path));
  }
  // A handler that returns nothing (e.g. a plain delete) sends an empty body — response.json()
  // throws on that ("Unexpected end of JSON input"), which without this looked exactly like a
  // failed request even though the call had already succeeded server-side.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  // No Content-Type here on purpose: the browser must set the multipart boundary itself.
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeader(),
    body: formData,
  });
  if (!response.ok) {
    handleUnauthorized(response);
    throw new Error(`Request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', credentials: 'include', headers: authHeader() });
  if (!response.ok) {
    handleUnauthorized(response);
    throw new Error(`Request failed: ${response.status} ${path}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Resolves a backend-relative path (e.g. an uploaded file's /uploads/{id}) against the API origin — the frontend and backend are served from separate origins. */
export function resolveApiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData),
  download: downloadFile,
};
