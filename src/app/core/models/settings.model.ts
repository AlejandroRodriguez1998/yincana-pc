/** Documento settings/competition: ajustes globales de la yincana (solo jueces escriben). */
export interface CompetitionSettings {
  /**
   * Si es false, los grupos no pueden ver el ranking ni su posición: solo sus
   * propios resultados. Lo impone firestore.rules, no solo la interfaz.
   */
  readonly rankingRevealed: boolean;
  /** Momento (hora del servidor) en que un juez pulsó "Revelar". */
  readonly revealedAt: Date | null;
}

export const DEFAULT_SETTINGS: CompetitionSettings = { rankingRevealed: false, revealedAt: null };

/**
 * Tras pulsar "Revelar", los grupos esperan a que termine la animación del
 * podio en la pantalla final para no hacerse spoiler. Debe coincidir con el
 * valor usado en firestore.rules (duration.value(12, 's')).
 */
export const GROUP_REVEAL_DELAY_MS = 12_000;
