/**
 * Resumen de la competición en dos documentos, para mostrar rankings con
 * 1 lectura por actualización en vez de leer toda la colección de resultados:
 *
 * - standings/current (solo jueces): desglose por grupo y prueba.
 * - standings/public (jueces y grupos): solo nombre, tiempo total y pruebas
 *   completadas de cada grupo. Así un grupo no puede leer los tiempos por
 *   prueba de los demás, ni siquiera accediendo a Firestore directamente.
 */
export interface StandingResult {
  /** Tiempo final de la prueba (cronometrado + penalización), en ms. */
  readonly totalMs: number;
  readonly penaltyMs: number;
}

export interface StandingGroup {
  readonly name: string;
  readonly active: boolean;
  /** Clave: testId. */
  readonly results: Readonly<Record<string, StandingResult>>;
}

export interface Standings {
  /** Clave: groupId. */
  readonly groups: Readonly<Record<string, StandingGroup>>;
}

/** Entrada de standings/public: totales ya calculados sobre las pruebas activas. */
export interface PublicStanding {
  readonly name: string;
  readonly active: boolean;
  readonly totalMs: number;
  readonly completed: number;
}

export interface PublicStandings {
  /** Clave: groupId. */
  readonly groups: Readonly<Record<string, PublicStanding>>;
}

export interface RankingEntry {
  readonly groupId: string;
  readonly name: string;
  /** Suma de los tiempos finales de las pruebas activas completadas, en ms. */
  readonly totalMs: number;
  readonly completed: number;
  /** Posición con empates: dos grupos empatados comparten posición (1, 1, 3...). */
  readonly position: number;
  readonly tied: boolean;
  /** Resultados por prueba activa (vacío en el ranking público). */
  readonly results: Readonly<Record<string, StandingResult>>;
}
