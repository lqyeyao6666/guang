export interface Settings {
  pitch: number;
  rotationSpeed: number;
  musicEnabled: boolean;
  musicVolume: number;
  soundEffectsEnabled: boolean;
}

export const defaultSettings: Settings = { pitch: 53, rotationSpeed: 1, musicEnabled: true, musicVolume: 0.5, soundEffectsEnabled: true };
const storageKey = 'warm-light.settings.v1';

export function normalizeSettings(value: unknown): Settings {
  const input = value && typeof value === 'object' ? value as Partial<Settings> : {};
  return {
    pitch: typeof input.pitch === 'number' && Number.isFinite(input.pitch) ? Math.max(30, Math.min(85, input.pitch)) : defaultSettings.pitch,
    rotationSpeed: typeof input.rotationSpeed === 'number' && Number.isFinite(input.rotationSpeed) ? Math.max(0.5, Math.min(1.5, input.rotationSpeed)) : defaultSettings.rotationSpeed,
    musicEnabled: typeof input.musicEnabled === 'boolean' ? input.musicEnabled : defaultSettings.musicEnabled,
    musicVolume: typeof input.musicVolume === 'number' && Number.isFinite(input.musicVolume) ? Math.max(0, Math.min(1, input.musicVolume)) : defaultSettings.musicVolume,
    soundEffectsEnabled: typeof input.soundEffectsEnabled === 'boolean' ? input.soundEffectsEnabled : defaultSettings.soundEffectsEnabled,
  };
}

export function loadSettings(): Settings {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(storageKey) ?? 'null')); }
  catch { return { ...defaultSettings }; }
}

export function saveSettings(settings: Settings): boolean {
  try { localStorage.setItem(storageKey, JSON.stringify(settings)); return true; }
  catch { return false; }
}
