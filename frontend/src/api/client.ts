const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${path}`);
  return response.json() as Promise<T>;
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  // No Content-Type here on purpose: the browser must set the multipart boundary itself.
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${path}`);
  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData),
};
