import { DiskConfig, DiskQuestion, DiskReveal, DiskSector, DiskStep } from '../models';

/** Fuente de aleatoriedad: entero en [0, max). Se inyecta para poder testear. */
export type RandomInt = (max: number) => number;

export const cryptoRandomInt: RandomInt = (max) => {
  if (max <= 1) return 0;
  // Rechazo para evitar sesgo de módulo.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
};

/** Sin 0/O, 1/I/L: se teclean sin confusiones. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const DISK_CODE_LENGTH = 6;

export function shuffle<T>(items: readonly T[], rand: RandomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function randomCode(rand: RandomInt, taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < DISK_CODE_LENGTH; i++) code += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
}

/** Etiqueta hexadecimal libre entre 0x10 y 0xFF. */
export function randomLabel(rand: RandomInt, taken: ReadonlySet<string>): string {
  const free: string[] = [];
  for (let n = 0x10; n <= 0xff; n++) {
    const label = `0x${n.toString(16).toUpperCase()}`;
    if (!taken.has(label)) free.push(label);
  }
  return free.length ? free[rand(free.length)] : `0x${(0x100 + taken.size).toString(16).toUpperCase()}`;
}

/** Añade o quita sectores conservando los existentes (sus tarjetas ya pueden estar impresas). */
export function resizeSectors(
  sectors: readonly DiskSector[],
  count: number,
  rand: RandomInt,
): DiskSector[] {
  const result = sectors.slice(0, count);
  const labels = new Set(result.map((s) => s.label));
  const codes = new Set(result.map((s) => s.code));
  while (result.length < count) {
    const label = randomLabel(rand, labels);
    const code = randomCode(rand, codes);
    labels.add(label);
    codes.add(code);
    result.push({ label, location: '', code });
  }
  return result;
}

/** Problemas de configuración que impiden generar los discos (vacío = todo bien). */
export function configProblems(config: DiskConfig): string[] {
  const problems: string[] = [];
  if (config.chainLength < 1) problems.push('El archivo debe ocupar al menos 1 sector.');
  if (config.sectors.length < config.chainLength) {
    problems.push(`Hacen falta al menos ${config.chainLength} sectores físicos (hay ${config.sectors.length}).`);
  }
  if (config.questions.length < config.chainLength) {
    problems.push(
      `Hacen falta al menos ${config.chainLength} preguntas (una por sector; hay ${config.questions.length}).`,
    );
  }
  if (config.questions.some((q) => !validQuestion(q))) {
    problems.push('Hay preguntas incompletas: necesitan enunciado, 2 o más opciones y una correcta.');
  }
  return problems;
}

export function validQuestion(q: DiskQuestion): boolean {
  return (
    q.text.trim().length > 0 &&
    q.options.length >= 2 &&
    q.options.every((o) => o.trim().length > 0) &&
    Number.isInteger(q.correct) &&
    q.correct >= 0 &&
    q.correct < q.options.length
  );
}

/** Disco de un grupo: todo lo que se escribe en Firestore para él. */
export interface GroupDisk {
  readonly codes: string[];
  readonly labels: string[];
  readonly answers: number[];
  readonly fragments: string[];
  readonly file: string;
  readonly steps: DiskStep[];
  readonly reveals: DiskReveal[];
}

/**
 * Cadena aleatoria para un grupo: qué sectores recorre y en qué orden, qué
 * pregunta hay en cada uno (con las opciones barajadas, para que "es la B"
 * no sirva entre grupos) y qué fragmento guarda.
 */
export function planGroupDisk(config: DiskConfig, rand: RandomInt): GroupDisk {
  const chain = shuffle(config.sectors, rand).slice(0, config.chainLength);
  const questions = shuffle(config.questions, rand).slice(0, config.chainLength);

  const codes: string[] = [];
  const labels: string[] = [];
  const answers: number[] = [];
  const fragments: string[] = [];
  const steps: DiskStep[] = [];

  chain.forEach((sector, i) => {
    const q = questions[i];
    const order = shuffle(
      q.options.map((_, index) => index),
      rand,
    );
    let fragment = '';
    for (let d = 0; d < config.fragmentDigits; d++) fragment += String(rand(10));

    codes.push(sector.code);
    labels.push(sector.label);
    answers.push(order.indexOf(q.correct));
    fragments.push(fragment);
    steps.push({
      index: i,
      label: sector.label,
      question: q.text.trim(),
      options: order.map((index) => q.options[index].trim()),
    });
  });

  const reveals: DiskReveal[] = [{ index: 0, fragment: null, nextLabel: labels[0] ?? null }];
  for (let i = 1; i <= chain.length; i++) {
    reveals.push({ index: i, fragment: fragments[i - 1], nextLabel: labels[i] ?? null });
  }

  return { codes, labels, answers, fragments, file: fragments.join(''), steps, reveals };
}
