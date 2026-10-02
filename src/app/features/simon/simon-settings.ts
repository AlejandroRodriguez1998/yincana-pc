import {
  SIMON_DEFAULTS,
  SIMON_DIFFICULTIES,
  SIMON_PENALTY_MAX,
  SIMON_ROUNDS_MAX,
  SimonConfig,
  SimonDifficulty,
} from '../../core/models';

/** Ajustes de una partida: se eligen en "Registrar tiempo" y viajan a /simon por la URL. */
export interface SimonPlaySettings extends SimonConfig {
  readonly difficulty: SimonDifficulty;
}

export const DEFAULT_PLAY_SETTINGS: SimonPlaySettings = { ...SIMON_DEFAULTS, difficulty: 'normal' };
export const PENALTY_OPTIONS = [0, 5, 10, 15, 30] as const;

const STORAGE_KEY = 'yincana.simon.settings';

function toInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
}

/** Normaliza ajustes de cualquier origen (URL, almacenamiento) dentro de los límites. */
export function normalizeSettings(raw: {
  difficulty?: unknown;
  rounds?: unknown;
  penaltySeconds?: unknown;
}): SimonPlaySettings {
  const rounds = toInt(raw.rounds);
  const penalty = toInt(raw.penaltySeconds);
  return {
    difficulty: SIMON_DIFFICULTIES.find((d) => d === raw.difficulty) ?? DEFAULT_PLAY_SETTINGS.difficulty,
    rounds: rounds === null ? DEFAULT_PLAY_SETTINGS.rounds : Math.min(SIMON_ROUNDS_MAX, Math.max(1, rounds)),
    penaltySeconds:
      penalty === null ? DEFAULT_PLAY_SETTINGS.penaltySeconds : Math.min(SIMON_PENALTY_MAX, Math.max(0, penalty)),
  };
}

/** Últimos ajustes usados en este dispositivo. */
export function loadSettings(): SimonPlaySettings {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return DEFAULT_PLAY_SETTINGS;
    return normalizeSettings({
      difficulty: Reflect.get(raw, 'difficulty'),
      rounds: Reflect.get(raw, 'rounds'),
      penaltySeconds: Reflect.get(raw, 'penaltySeconds'),
    });
  } catch {
    return DEFAULT_PLAY_SETTINGS;
  }
}

export function saveSettings(settings: SimonPlaySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sin almacenamiento, los ajustes solo duran esta sesión.
  }
}

/** Query params de /simon para unos ajustes. */
export function settingsQueryParams(settings: SimonPlaySettings): Record<string, string | number> {
  return {
    dificultad: settings.difficulty,
    rondas: settings.rounds,
    penalizacion: settings.penaltySeconds,
  };
}
