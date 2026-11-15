import { useSyncExternalStore } from 'react';

/** Per-browser preferences (never anything that must be shared or reliable). */
export interface Prefs {
  micOn: boolean;
  cameraOn: boolean;
  layout: 'grid' | 'spotlight';
  stripPosition: 'right' | 'bottom';
  autoPiP: boolean;
  mutedIdentities: Set<string>;
}

const KEY = 'gathyr:prefs';
const defaults: Prefs = {
  micOn: true, cameraOn: true, layout: 'grid', stripPosition: 'right', autoPiP: true,
  mutedIdentities: new Set(),
};

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...defaults, ...raw, mutedIdentities: new Set(raw.mutedIdentities ?? []) };
  } catch {
    return { ...defaults };
  }
}

let prefs = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...prefs, mutedIdentities: [...prefs.mutedIdentities] }));
  } catch { /* ignore */ }
}

export function getPrefs(): Prefs {
  return prefs;
}

export function savePref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  prefs = { ...prefs, [key]: value };
  persist();
  listeners.forEach((l) => l());
}

export function toggleLocalMute(identity: string): void {
  const next = new Set(prefs.mutedIdentities);
  if (next.has(identity)) next.delete(identity);
  else next.add(identity);
  savePref('mutedIdentities', next);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => prefs,
  );
}
