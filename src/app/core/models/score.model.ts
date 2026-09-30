/**
 * Documento scores/{groupId}__{testId}: el resultado de un grupo en una prueba.
 * El ID determinista garantiza un único resultado por combinación grupo/prueba.
 */
export interface Score {
  readonly id: string;
  readonly groupId: string;
  readonly testId: string;
  /** Tiempo cronometrado, en milisegundos. */
  readonly timeMs: number;
  /** Penalización en milisegundos (se suma al tiempo). */
  readonly penaltyMs: number;
  /** totalMs = timeMs + penaltyMs. Validado también en firestore.rules. */
  readonly totalMs: number;
  readonly judgeId: string;
  readonly judgeName: string;
  /** Entrada de auditoría escrita en la misma transacción que la última modificación. */
  readonly auditId: string;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface ScoreInput {
  readonly timeMs: number;
  readonly penaltyMs: number;
}

/** Valores de un resultado que se guardan en el historial. */
export interface ScoreValues {
  readonly timeMs: number;
  readonly penaltyMs: number;
  readonly totalMs: number;
}

/** Límite de seguridad para tiempos y penalizaciones: 24 horas. */
export const MAX_TIME_MS = 24 * 60 * 60 * 1000;

export function scoreDocId(groupId: string, testId: string): string {
  return `${groupId}__${testId}`;
}

/** Regla de la yincana: tiempo final = tiempo cronometrado + penalización. */
export function computeTotalTime(timeMs: number, penaltyMs: number): number {
  return timeMs + penaltyMs;
}
