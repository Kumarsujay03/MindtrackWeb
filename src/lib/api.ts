const DEFAULT_BASE = "https://mintrack-web.vercel.app"; // Vercel production domain

export function getApiBase(): string {
  // Allow override via Vite env variable if present, else use Vercel domain
  const envBase = (import.meta as any)?.env?.VITE_API_BASE;
  if (typeof envBase === "string" && envBase.trim()) return envBase.replace(/\/$/, "");
  return DEFAULT_BASE;
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init);
}
