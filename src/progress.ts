import { levelSummaries } from './level.ts';
import type { LevelNumber } from './level.ts';

export const progressStorageKey = 'warm-light.progress.v1';
export const debugStorageKey = 'warm-light.debug-session.v1';
export interface Progress { completed: LevelNumber[] }

// Only a contiguous sequence counts. Internal level IDs are not chapter order.
export function normalizeProgress(value: unknown): Progress {
  const candidate = value && typeof value === 'object' ? (value as Partial<Progress>).completed : [];
  const stored = new Set(Array.isArray(candidate) ? candidate : []);
  const completed: LevelNumber[] = [];
  for (const entry of levelSummaries) {
    if (!stored.has(entry.number)) break;
    completed.push(entry.number);
  }
  return { completed };
}

export function nextPlayable(progress: Progress): LevelNumber {
  return levelSummaries[Math.min(progress.completed.length, levelSummaries.length - 1)].number;
}

export function isUnlocked(progress: Progress, number: LevelNumber): boolean {
  const index = levelSummaries.findIndex(entry => entry.number === number);
  return index >= 0 && index <= progress.completed.length;
}

export class GameProgress {
  data: Progress = { completed: [] };
  debug = false;
  saved = true;

  constructor() {
    this.reload();
    try { this.debug = sessionStorage.getItem(debugStorageKey) === 'enabled'; } catch { /* Memory-only debug mode still works. */ }
  }

  reload(): void {
    try { this.data = normalizeProgress(JSON.parse(localStorage.getItem(progressStorageKey) ?? 'null')); }
    catch { this.data = { completed: [] }; }
  }

  canPlay(number: LevelNumber): boolean { return this.debug || isUnlocked(this.data, number); }

  complete(number: LevelNumber): boolean {
    if (!isUnlocked(this.data, number) || this.data.completed.includes(number)) return false;
    this.data.completed.push(number);
    this.persist();
    return true;
  }

  authenticate(password: string): boolean {
    if (password !== '123456') return false;
    this.setDebug(true);
    return true;
  }

  setDebug(enabled: boolean): void {
    this.debug = enabled;
    try {
      if (enabled) sessionStorage.setItem(debugStorageKey, 'enabled');
      else sessionStorage.removeItem(debugStorageKey);
    } catch { /* Keep this tab usable when storage is unavailable. */ }
  }

  reset(): void { this.data = { completed: [] }; this.persist(); }

  private persist(): void {
    try { localStorage.setItem(progressStorageKey, JSON.stringify(this.data)); this.saved = true; }
    catch { this.saved = false; }
  }
}
