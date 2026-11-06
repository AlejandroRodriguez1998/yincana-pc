/*
 * Prueba "Recupera el archivo" (tests con kind 'disk').
 *
 * Simula cómo guarda un disco un archivo fragmentado: el archivo de cada grupo
 * está repartido en sectores (tarjetas con QR escondidas por el centro) y cada
 * sector indica cuál es el siguiente, como la tabla FAT. Al escanear un sector
 * el grupo responde una pregunta; si acierta, lee su fragmento y el puntero al
 * siguiente. Al final escribe el archivo completo.
 *
 * Documentos (runId = `${testId}__${groupId}`):
 * - diskConfigs/{testId}     Solo jueces. Sectores físicos, banco de preguntas y ajustes.
 * - diskSecrets/{runId}      Solo jueces. Códigos, respuestas y archivo de cada grupo.
 *                            Las reglas lo usan para validar el avance del grupo.
 * - diskInfos/{runId}        El grupo: que su disco está listo, nº de sectores, penalización y si
 *                            un juez le ha dado acceso (`unlocked`) para empezar.
 * - diskSteps/{runId}__{i}   Pregunta del sector i. El grupo la lee tras escanear ese sector.
 * - diskReveals/{runId}__{i} i = 0: sector inicial. i > 0: fragmento del sector i-1 y
 *                            puntero al siguiente. El grupo la lee tras acertar la pregunta.
 * - diskRuns/{runId}         Partida del grupo. La escribe el propio grupo; las reglas
 *                            solo dejan avanzar con el código o la respuesta correctos.
 */

/** Tarjeta física: se imprime con su etiqueta, su código y un QR con el código. */
export interface DiskSector {
  /** Etiqueta visible, p. ej. "0x2A". */
  readonly label: string;
  /** Dónde se esconde (para la tabla FAT que se cuelga en la pared). */
  readonly location: string;
  /** Código secreto de la tarjeta (sin guiones). Sin él no se puede "leer" el sector. */
  readonly code: string;
}

export interface DiskQuestion {
  readonly text: string;
  readonly options: readonly string[];
  /** Índice de la opción correcta. */
  readonly correct: number;
}

export interface DiskConfig {
  readonly sectors: readonly DiskSector[];
  readonly questions: readonly DiskQuestion[];
  /** Sectores que ocupa el archivo de cada grupo (≤ sectores físicos). */
  readonly chainLength: number;
  readonly penaltySeconds: number;
  /** Dígitos de cada fragmento del archivo. */
  readonly fragmentDigits: number;
}

/** Datos secretos de un grupo (solo jueces). */
export interface DiskSecret {
  readonly testId: string;
  readonly groupId: string;
  /** Código de la tarjeta de cada paso de la cadena. */
  readonly codes: readonly string[];
  /** Etiqueta del sector de cada paso (para el panel del juez). */
  readonly labels: readonly string[];
  /** Opción correcta (ya barajada) de cada paso. */
  readonly answers: readonly number[];
  /** Archivo completo: la concatenación de los fragmentos. */
  readonly file: string;
  readonly count: number;
  readonly penaltyMs: number;
}

/** Lo que el grupo ve antes de empezar. */
export interface DiskInfo {
  readonly testId: string;
  readonly groupId: string;
  readonly count: number;
  readonly penaltyMs: number;
  readonly fragmentDigits: number;
  /** Un juez ha dado acceso: el grupo ya puede montar el disco y empezar. */
  readonly unlocked: boolean;
}

export interface DiskStep {
  readonly index: number;
  readonly label: string;
  readonly question: string;
  readonly options: readonly string[];
}

export interface DiskReveal {
  readonly index: number;
  /** Fragmento del sector index-1 (null en el sector inicial). */
  readonly fragment: string | null;
  /** Etiqueta del siguiente sector (null si el archivo ha terminado). */
  readonly nextLabel: string | null;
}

export interface DiskRun {
  readonly id: string;
  readonly testId: string;
  readonly groupId: string;
  readonly startedAt: Date | null;
  /** Sectores encontrados (tarjeta escaneada). */
  readonly found: number;
  /** Sectores leídos (pregunta acertada). */
  readonly step: number;
  /** Respuestas falladas (preguntas y archivo final). */
  readonly wrong: number;
  readonly finishedAt: Date | null;
}

export type DiskPhase = 'locate' | 'question' | 'rebuild' | 'done';

export function diskPhase(run: DiskRun, count: number): DiskPhase {
  if (run.finishedAt) return 'done';
  if (run.step >= count) return 'rebuild';
  return run.found > run.step ? 'question' : 'locate';
}

export function diskRunId(testId: string, groupId: string): string {
  return `${testId}__${groupId}`;
}

export function diskItemId(runId: string, index: number): string {
  return `${runId}__${index}`;
}

/** Normaliza un código escaneado o tecleado: mayúsculas, sin guiones ni espacios. */
export function normalizeDiskCode(text: string): string {
  // Si es la URL del QR, el código va en ?s=…
  const match = /[?&]s=([^&#]+)/.exec(text);
  const raw = match ? decodeURIComponent(match[1]) : text;
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "K7PQ2M" → "K7P-Q2M" (más fácil de leer en la tarjeta). */
export function formatDiskCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

/** El archivo solo cuenta los dígitos: espacios, guiones o puntos dan igual. */
export function normalizeDiskFile(text: string): string {
  return text.replace(/\D/g, '');
}

export const DISK_DEFAULTS = {
  chainLength: 6,
  penaltySeconds: 30,
  fragmentDigits: 4,
  sectorCount: 10,
} as const;

export const DISK_SECTORS_MAX = 40;
export const DISK_QUESTIONS_MAX = 80;
export const DISK_CHAIN_MAX = 20;
export const DISK_LOCATION_MAX = 120;
export const DISK_QUESTION_MAX = 300;
export const DISK_OPTION_MAX = 120;
