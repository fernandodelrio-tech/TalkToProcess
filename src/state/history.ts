/**
 * In-session composition history (FR-23) with optional local-only persistence
 * (FR-24). Nothing leaves the browser (NFR-8, NFR-10): persistence uses
 * localStorage and is opt-in.
 */

import type { CompositionResult, EngineKind } from '../engine/models';

export interface HistoryEntry {
  id: string;
  createdAt: number;
  description: string;
  result: CompositionResult;
  engine: EngineKind;
}

const STORAGE_KEY = 'process-compositor:history:v1';
const MAX_ENTRIES = 50;

let counter = 0;
/** Monotonic id without Date.now/Math.random dependence in hot paths. */
function nextId(): string {
  counter += 1;
  return `h${counter}-${counter.toString(36)}`;
}

export function makeEntry(
  description: string,
  result: CompositionResult,
  engine: EngineKind,
  createdAt: number,
): HistoryEntry {
  return { id: nextId(), createdAt, description, result, engine };
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[], persist: boolean): void {
  if (!persist) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage disabled/full — history stays in-memory only. Non-fatal.
  }
}

export function clearPersistedHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
