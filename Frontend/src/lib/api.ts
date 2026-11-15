import { config } from './config';
import type { RoomSnapshot, SessionResponse } from './types';
import { withDeadlines } from './time';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Can't reach Gathyr. Check your connection.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const message = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? 'Please check what you entered.' : 'Something went wrong.';
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

function session(r: SessionResponse): SessionResponse {
  return { ...r, room: withDeadlines(r.room) as RoomSnapshot };
}

export interface RoomPreview {
  code: string;
  participant_count: number;
  names: string[];
  full: boolean;
  game: string | null;
}

export const api = {
  createRoom: async (name: string) =>
    session(await request<SessionResponse>('/api/rooms', { method: 'POST', body: JSON.stringify({ name }) })),

  joinRoom: async (code: string, name: string) =>
    session(await request<SessionResponse>(`/api/rooms/${encodeURIComponent(code.toUpperCase())}/join`, {
      method: 'POST', body: JSON.stringify({ name }),
    })),

  resume: async (code: string, token: string) =>
    session(await request<SessionResponse>(`/api/rooms/${encodeURIComponent(code.toUpperCase())}/session`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })),

  leave: (code: string, token: string) =>
    request<void>(`/api/rooms/${encodeURIComponent(code.toUpperCase())}/session`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, keepalive: true,
    }),

  preview: (code: string) => request<RoomPreview>(`/api/rooms/${encodeURIComponent(code.toUpperCase())}`),

  feedback: (type: 'bug' | 'suggestion', text: string, room_code?: string) =>
    request<void>('/api/feedback', { method: 'POST', body: JSON.stringify({ type, text, room_code }) }),
};
