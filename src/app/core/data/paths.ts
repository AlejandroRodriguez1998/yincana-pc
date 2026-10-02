/** Nombres de colecciones y documentos fijos de Firestore. */
export const COLLECTIONS = {
  users: 'users',
  groups: 'groups',
  tests: 'tests',
  scores: 'scores',
  auditLogs: 'auditLogs',
  standings: 'standings',
  settings: 'settings',
  judgeRequests: 'judgeRequests',
} as const;

/** Desglose por grupo y prueba (solo jueces). */
export const STANDINGS_DOC_ID = 'current';
/** Totales por grupo (jueces y grupos). */
export const PUBLIC_STANDINGS_DOC_ID = 'public';

/** Ajustes globales de la competición (p. ej. si el ranking está revelado). */
export const SETTINGS_DOC_ID = 'competition';
