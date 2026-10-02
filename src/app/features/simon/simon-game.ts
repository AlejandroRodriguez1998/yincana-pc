/** Lógica pura del Simón dice (sin Angular), para poder probarla aisladamente. */
import { SimonDifficulty } from '../../core/models';

export const PAD_COUNT = 4;

/** Entero aleatorio en [0, max) con crypto, para que la secuencia no sea predecible. */
function randomInt(max: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] ?? 0) % max;
}

/** Probabilidad de repetir el color del paso anterior (las repeticiones hacen el juego monótono). */
const REPEAT_CHANCE = 1 / 8;

/**
 * Siguiente paso de la secuencia:
 * - nunca tres veces seguidas el mismo color;
 * - repetir el color anterior es poco probable (REPEAT_CHANCE).
 */
export function nextPad(sequence: readonly number[], random: (max: number) => number = randomInt): number {
  const last = sequence.at(-1);
  const beforeLast = sequence.at(-2);
  if (last === undefined) return random(PAD_COUNT);
  const allowRepeat = last !== beforeLast && random(1000) < REPEAT_CHANCE * 1000;
  if (allowRepeat) return last;
  // Uno de los otros tres colores, al azar.
  const others = [0, 1, 2, 3].filter((pad) => pad !== last);
  return others[random(others.length)]!;
}

/** Paso aleatorio (0-3), sin restricciones. */
export function randomPad(): number {
  return randomInt(PAD_COUNT);
}

/** Parámetros de cada nivel: pasos de la primera ronda y velocidad (ms). */
export const DIFFICULTY_SETTINGS: Readonly<
  Record<
    SimonDifficulty,
    {
      readonly startSteps: number;
      readonly flashStart: number;
      readonly flashMin: number;
      readonly gapStart: number;
      readonly gapMin: number;
      readonly speedUp: number;
    }
  >
> = {
  easy: { startSteps: 1, flashStart: 650, flashMin: 320, gapStart: 240, gapMin: 130, speedUp: 30 },
  normal: { startSteps: 2, flashStart: 520, flashMin: 240, gapStart: 180, gapMin: 100, speedUp: 35 },
  hard: { startSteps: 3, flashStart: 420, flashMin: 180, gapStart: 130, gapMin: 70, speedUp: 35 },
};

/** Pasos que hay que repetir en la ronda `round` (1, 2, …). */
export function stepsInRound(round: number, difficulty: SimonDifficulty): number {
  return DIFFICULTY_SETTINGS[difficulty].startSteps + round - 1;
}

/** Duración del destello de cada paso: se acelera con las rondas. */
export function flashDurationMs(round: number, difficulty: SimonDifficulty): number {
  const d = DIFFICULTY_SETTINGS[difficulty];
  return Math.max(d.flashMin, d.flashStart - (round - 1) * d.speedUp);
}

/** Pausa entre pasos al mostrar la secuencia. */
export function flashGapMs(round: number, difficulty: SimonDifficulty): number {
  const d = DIFFICULTY_SETTINGS[difficulty];
  return Math.max(d.gapMin, d.gapStart - (round - 1) * 10);
}

/** Resultado de una pulsación del jugador. */
export type PressOutcome = 'correct' | 'roundComplete' | 'gameComplete' | 'wrong';

/**
 * Evalúa la pulsación `pad` en la posición `index` de una ronda que exige
 * repetir los `steps` primeros pasos de la secuencia.
 */
export function evaluatePress(
  sequence: readonly number[],
  steps: number,
  isFinalRound: boolean,
  index: number,
  pad: number,
): PressOutcome {
  if (sequence[index] !== pad) return 'wrong';
  if (index + 1 < steps) return 'correct';
  return isFinalRound ? 'gameComplete' : 'roundComplete';
}
