import type { EngineSession } from '../atc/engine';
import type { ScoreResult } from '../atc/types';

export type LocalRadioEvent = {
  at: string;
  scenarioId: string;
  scenarioVersion: number;
  stateId: string;
  transcript: string;
  score: ScoreResult;
};

const KEY = 'aerocomm-session-v1';
const LEGACY_KEYS = ['aerocomm-mvp-session-v05', 'aerocomm-mvp-session-v04'];
export type LocalSnapshot = { session: EngineSession; events: LocalRadioEvent[] };

function parseSnapshot(raw: string | null): LocalSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LocalSnapshot;
    if (!value?.session || !Array.isArray(value.events)) return null;
    return value;
  } catch {
    return null;
  }
}

export function loadLocalSnapshot(): LocalSnapshot | null {
  if (typeof window === 'undefined') return null;
  const current = parseSnapshot(localStorage.getItem(KEY));
  if (current) return current;

  for (const legacyKey of LEGACY_KEYS) {
    const legacy = parseSnapshot(localStorage.getItem(legacyKey));
    if (!legacy) continue;
    localStorage.setItem(KEY, JSON.stringify(legacy));
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    return legacy;
  }
  return null;
}

export function saveLocalSnapshot(snapshot: LocalSnapshot) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(snapshot));
}

export function clearLocalSnapshot() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}
