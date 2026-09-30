/**
 * Documento tests/{testId}: una prueba de la yincana. Todas las pruebas se cronometran.
 * Una prueba inactiva queda fuera de la competición: no se puede registrar
 * y su tiempo no cuenta en el ranking (se conserva por si se reactiva).
 */
export interface Test {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly active: boolean;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface TestInput {
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly active: boolean;
}

export const TEST_NAME_MAX = 80;
export const TEST_DESCRIPTION_MAX = 1000;
