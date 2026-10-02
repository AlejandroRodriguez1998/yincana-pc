/** Cómo se juega una prueba. Todas producen un tiempo (más penalizaciones). */
export type TestKind = 'timer' | 'simon';

/** Nivel del Simón dice (se elige al empezar cada partida): pasos iniciales y velocidad. */
export type SimonDifficulty = 'easy' | 'normal' | 'hard';

export const SIMON_DIFFICULTIES: readonly SimonDifficulty[] = ['easy', 'normal', 'hard'];

export const SIMON_DIFFICULTY_LABELS: Readonly<Record<SimonDifficulty, string>> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
};

/** Configuración de una partida de Simón dice (se elige al empezar, no se guarda en la prueba). */
export interface SimonConfig {
  /** Rondas a superar; cada ronda añade un paso a la secuencia. */
  readonly rounds: number;
  /** Segundos que se suman por cada fallo (y se repite la ronda). */
  readonly penaltySeconds: number;
}

export const SIMON_DEFAULTS: SimonConfig = { rounds: 8, penaltySeconds: 10 };
export const SIMON_ROUNDS_MAX = 30;
export const SIMON_PENALTY_MAX = 600;

/**
 * Documento tests/{testId}: una prueba de la yincana.
 * Una prueba inactiva queda fuera de la competición: no se puede registrar
 * y su tiempo no cuenta en el ranking (se conserva por si se reactiva).
 */
export interface Test {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly active: boolean;
  readonly kind: TestKind;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface TestInput {
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly active: boolean;
  readonly kind: TestKind;
}

export const TEST_NAME_MAX = 80;
export const TEST_DESCRIPTION_MAX = 1000;
