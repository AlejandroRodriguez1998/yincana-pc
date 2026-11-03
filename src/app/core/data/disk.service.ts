import { Injectable, inject } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  WriteBatch,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { AppError } from '../firebase/errors';
import { FIRESTORE } from '../firebase/firebase.providers';
import {
  DISK_DEFAULTS,
  DiskConfig,
  DiskInfo,
  DiskQuestion,
  DiskReveal,
  DiskRun,
  DiskSecret,
  DiskSector,
  DiskStep,
  Group,
  diskItemId,
  diskRunId,
  normalizeDiskCode,
  normalizeDiskFile,
} from '../models';
import { ActorService } from './actor';
import { DEFAULT_DISK_QUESTIONS } from './disk-questions';
import { configProblems, cryptoRandomInt, planGroupDisk, resizeSectors } from './disk-plan';
import { COLLECTIONS } from './paths';

// ------------------------------------------------------------------ mappers

type Data = Readonly<Record<string, unknown>>;

function data(snapshot: DocumentSnapshot): Data {
  return snapshot.data({ serverTimestamps: 'estimate' }) ?? {};
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str) : []);
const intList = (v: unknown): number[] => (Array.isArray(v) ? v.map(int) : []);
const date = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);
const isRecord = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);

function toSector(v: unknown): DiskSector | null {
  if (!isRecord(v)) return null;
  const label = str(v['label']);
  const code = str(v['code']);
  return label && code ? { label, code, location: str(v['location']) } : null;
}

function toQuestion(v: unknown): DiskQuestion | null {
  if (!isRecord(v)) return null;
  return { text: str(v['text']), options: strList(v['options']), correct: int(v['correct']) };
}

export function toDiskConfig(snapshot: DocumentSnapshot): DiskConfig {
  const d = data(snapshot);
  const sectors = Array.isArray(d['sectors']) ? d['sectors'].map(toSector) : [];
  const questions = Array.isArray(d['questions']) ? d['questions'].map(toQuestion) : [];
  return {
    sectors: sectors.filter((s): s is DiskSector => s !== null),
    questions: questions.filter((q): q is DiskQuestion => q !== null),
    chainLength: int(d['chainLength']) || DISK_DEFAULTS.chainLength,
    penaltySeconds: int(d['penaltySeconds']),
    fragmentDigits: int(d['fragmentDigits']) || DISK_DEFAULTS.fragmentDigits,
  };
}

export function toDiskSecret(snapshot: DocumentSnapshot): DiskSecret {
  const d = data(snapshot);
  return {
    testId: str(d['testId']),
    groupId: str(d['groupId']),
    codes: strList(d['codes']),
    labels: strList(d['labels']),
    answers: intList(d['answers']),
    file: str(d['file']),
    count: int(d['count']),
    penaltyMs: int(d['penaltyMs']),
  };
}

export function toDiskInfo(snapshot: DocumentSnapshot): DiskInfo {
  const d = data(snapshot);
  return {
    testId: str(d['testId']),
    groupId: str(d['groupId']),
    count: int(d['count']),
    penaltyMs: int(d['penaltyMs']),
    fragmentDigits: int(d['fragmentDigits']) || DISK_DEFAULTS.fragmentDigits,
  };
}

export function toDiskRun(snapshot: DocumentSnapshot): DiskRun {
  const d = data(snapshot);
  return {
    id: snapshot.id,
    testId: str(d['testId']),
    groupId: str(d['groupId']),
    startedAt: date(d['startedAt']),
    found: int(d['found']),
    step: int(d['step']),
    wrong: int(d['wrong']),
    finishedAt: date(d['finishedAt']),
  };
}

function toDiskStep(snapshot: DocumentSnapshot): DiskStep {
  const d = data(snapshot);
  return {
    index: int(d['index']),
    label: str(d['label']),
    question: str(d['question']),
    options: strList(d['options']),
  };
}

function toDiskReveal(snapshot: DocumentSnapshot): DiskReveal {
  const d = data(snapshot);
  return {
    index: int(d['index']),
    fragment: typeof d['fragment'] === 'string' ? d['fragment'] : null,
    nextLabel: typeof d['nextLabel'] === 'string' ? d['nextLabel'] : null,
  };
}

// ------------------------------------------------------------------ helpers

function isDenied(err: unknown): boolean {
  return err instanceof FirebaseError && err.code === 'permission-denied';
}

/** Escribe en varios lotes (máx. 500 operaciones por lote en Firestore). */
async function commitChunked(db: Firestore, ops: ((batch: WriteBatch) => void)[]): Promise<void> {
  const CHUNK = 450;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    ops.slice(i, i + CHUNK).forEach((op) => op(batch));
    await batch.commit();
  }
}

export function newDiskConfig(): DiskConfig {
  return {
    sectors: resizeSectors([], DISK_DEFAULTS.sectorCount, cryptoRandomInt),
    questions: DEFAULT_DISK_QUESTIONS,
    chainLength: DISK_DEFAULTS.chainLength,
    penaltySeconds: DISK_DEFAULTS.penaltySeconds,
    fragmentDigits: DISK_DEFAULTS.fragmentDigits,
  };
}

export type AnswerResult = 'correct' | 'wrong';

/**
 * Prueba "Recupera el archivo". Los jueces configuran y generan los discos;
 * los grupos avanzan escribiendo en su diskRuns/{runId}, y las reglas de
 * Firestore solo aceptan cada avance con el código o la respuesta correctos
 * (que el grupo no puede leer). Ver disk.model.ts.
 */
@Injectable({ providedIn: 'root' })
export class DiskService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  // ------------------------------------------------------------ referencias

  configRef(testId: string): DocumentReference {
    return doc(this.db, COLLECTIONS.diskConfigs, testId);
  }

  infoRef(testId: string, groupId: string): DocumentReference {
    return doc(this.db, COLLECTIONS.diskInfos, diskRunId(testId, groupId));
  }

  runRef(testId: string, groupId: string): DocumentReference {
    return doc(this.db, COLLECTIONS.diskRuns, diskRunId(testId, groupId));
  }

  byTest(name: string, testId: string) {
    return query(collection(this.db, name), where('testId', '==', testId));
  }

  // ------------------------------------------------------------ jueces

  async loadConfig(testId: string): Promise<DiskConfig | null> {
    const snap = await getDoc(this.configRef(testId));
    return snap.exists() ? toDiskConfig(snap) : null;
  }

  async saveConfig(testId: string, config: DiskConfig): Promise<void> {
    this.actor.requireJudge();
    await setDoc(this.configRef(testId), {
      testId,
      sectors: config.sectors.map((s) => ({ label: s.label, location: s.location.trim(), code: s.code })),
      questions: config.questions.map((q) => ({
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()),
        correct: q.correct,
      })),
      chainLength: config.chainLength,
      penaltySeconds: config.penaltySeconds,
      fragmentDigits: config.fragmentDigits,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Genera (o regenera) el disco de cada grupo indicado: borra su partida y
   * sus datos anteriores y crea una cadena nueva.
   */
  async generate(testId: string, config: DiskConfig, groups: readonly Group[]): Promise<void> {
    this.actor.requireJudge();
    const problems = configProblems(config);
    if (problems.length) throw new AppError(problems[0]);
    if (groups.length === 0) throw new AppError('No hay grupos a los que generar el disco.');

    const groupIds = new Set(groups.map((g) => g.id));
    const ops: ((batch: WriteBatch) => void)[] = [];

    // Restos de una generación anterior (p. ej. con más sectores).
    for (const name of [COLLECTIONS.diskSteps, COLLECTIONS.diskReveals]) {
      const old = await getDocs(this.byTest(name, testId));
      for (const snap of old.docs) {
        if (groupIds.has(str(snap.get('groupId')))) ops.push((b) => b.delete(snap.ref));
      }
    }

    const penaltyMs = config.penaltySeconds * 1000;
    for (const group of groups) {
      const runId = diskRunId(testId, group.id);
      const disk = planGroupDisk(config, cryptoRandomInt);
      const base = { testId, groupId: group.id };
      ops.push((b) => b.delete(doc(this.db, COLLECTIONS.diskRuns, runId)));
      ops.push((b) =>
        b.set(doc(this.db, COLLECTIONS.diskSecrets, runId), {
          ...base,
          codes: disk.codes,
          labels: disk.labels,
          answers: disk.answers,
          file: disk.file,
          count: disk.codes.length,
          penaltyMs,
        }),
      );
      ops.push((b) =>
        b.set(doc(this.db, COLLECTIONS.diskInfos, runId), {
          ...base,
          count: disk.codes.length,
          penaltyMs,
          fragmentDigits: config.fragmentDigits,
          createdAt: serverTimestamp(),
        }),
      );
      for (const step of disk.steps) {
        ops.push((b) => b.set(doc(this.db, COLLECTIONS.diskSteps, diskItemId(runId, step.index)), { ...base, ...step }));
      }
      for (const reveal of disk.reveals) {
        ops.push((b) =>
          b.set(doc(this.db, COLLECTIONS.diskReveals, diskItemId(runId, reveal.index)), { ...base, ...reveal }),
        );
      }
    }
    await commitChunked(this.db, ops);
  }

  /** Borra la partida de un grupo: vuelve a "sin empezar" con el mismo disco. */
  async resetRun(testId: string, groupId: string): Promise<void> {
    this.actor.requireJudge();
    await deleteDoc(this.runRef(testId, groupId));
  }

  /** Borra todos los datos de la prueba de disco (al eliminar la prueba). */
  async purge(testId: string): Promise<void> {
    this.actor.requireJudge();
    const names = [
      COLLECTIONS.diskSecrets,
      COLLECTIONS.diskInfos,
      COLLECTIONS.diskSteps,
      COLLECTIONS.diskReveals,
      COLLECTIONS.diskRuns,
    ];
    const ops: ((batch: WriteBatch) => void)[] = [(b) => b.delete(this.configRef(testId))];
    for (const name of names) {
      const snap = await getDocs(this.byTest(name, testId));
      snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
    }
    await commitChunked(this.db, ops);
  }

  // ------------------------------------------------------------ grupos

  async startRun(testId: string, groupId: string): Promise<void> {
    try {
      await setDoc(this.runRef(testId, groupId), {
        testId,
        groupId,
        startedAt: serverTimestamp(),
        found: 0,
        step: 0,
        wrong: 0,
        lastCode: null,
        lastAnswer: null,
        finishedAt: null,
      });
    } catch (err) {
      if (isDenied(err)) {
        throw new AppError('No se puede empezar: la prueba no está activa o el disco ha cambiado. Avisa a un juez.');
      }
      throw err;
    }
  }

  /** true si el código es el del sector que toca; false si no. */
  async submitCode(run: DiskRun, text: string): Promise<boolean> {
    const code = normalizeDiskCode(text);
    if (!code) return false;
    try {
      await updateDoc(this.runRef(run.testId, run.groupId), { found: run.step + 1, lastCode: code });
      return true;
    } catch (err) {
      if (isDenied(err)) return false;
      throw err;
    }
  }

  /**
   * Responde la pregunta del sector actual. Las reglas solo aceptan el avance
   * con la respuesta correcta; si se rechaza, se registra el fallo.
   */
  async answer(run: DiskRun, option: number): Promise<AnswerResult> {
    const ref = this.runRef(run.testId, run.groupId);
    try {
      await updateDoc(ref, { step: run.step + 1, lastAnswer: option });
      return 'correct';
    } catch (err) {
      if (!isDenied(err)) throw err;
    }
    await updateDoc(ref, { wrong: run.wrong + 1, lastAnswer: option });
    return 'wrong';
  }

  /** Entrega el archivo reconstruido. */
  async submitFile(run: DiskRun, text: string): Promise<AnswerResult> {
    const ref = this.runRef(run.testId, run.groupId);
    const file = normalizeDiskFile(text);
    try {
      await updateDoc(ref, { finishedAt: serverTimestamp(), lastAnswer: file });
      return 'correct';
    } catch (err) {
      if (!isDenied(err)) throw err;
    }
    await updateDoc(ref, { wrong: run.wrong + 1, lastAnswer: file });
    return 'wrong';
  }

  async getStep(runId: string, index: number): Promise<DiskStep> {
    return toDiskStep(await getDoc(doc(this.db, COLLECTIONS.diskSteps, diskItemId(runId, index))));
  }

  async getReveal(runId: string, index: number): Promise<DiskReveal> {
    return toDiskReveal(await getDoc(doc(this.db, COLLECTIONS.diskReveals, diskItemId(runId, index))));
  }
}
