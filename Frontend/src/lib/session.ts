/** Per-room session persisted so a refresh resumes the same seat. */
export interface StoredSession {
  code: string;
  token: string;
  participantId: string;
  name: string;
}

const KEY = 'gathyr:session';
const NAME_KEY = 'gathyr:name';

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function loadSession(code: string): StoredSession | null {
  const s = read();
  return s && s.code.toUpperCase() === code.toUpperCase() ? s : null;
}

export function saveSession(s: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem(NAME_KEY, s.name);
  } catch { /* private mode */ }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function lastUsedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
