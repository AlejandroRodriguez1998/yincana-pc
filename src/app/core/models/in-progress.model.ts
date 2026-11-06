/**
 * Documento inProgress/{groupId}__{testId}: un grupo está haciendo una prueba ahora mismo.
 *
 * Lo crea el juez al arrancar el cronómetro (o una partida de Simón dice) y se borra
 * al guardar el resultado, al reiniciar el cronómetro o al abandonar la partida.
 * Una prueba está "ocupada" mientras tenga algún documento aquí.
 */
export interface InProgress {
  readonly id: string;
  readonly groupId: string;
  readonly testId: string;
  readonly groupName: string;
  readonly judgeId: string;
  readonly judgeName: string;
  readonly startedAt: Date | null;
}

/** Mismo ID determinista que los resultados: una entrada por grupo y prueba. */
export function inProgressDocId(groupId: string, testId: string): string {
  return `${groupId}__${testId}`;
}
