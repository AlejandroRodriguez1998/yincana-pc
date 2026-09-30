import { Injectable, inject } from '@angular/core';
import {
  FieldPath,
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { AppError } from '../firebase/errors';
import { FIRESTORE } from '../firebase/firebase.providers';
import {
  MAX_TIME_MS,
  ScoreInput,
  ScoreValues,
  StandingGroup,
  StandingResult,
  computeTotalTime,
  scoreDocId,
} from '../models';
import { toPublicStanding } from '../ranking/ranking';
import { ActorService } from './actor';
import { buildAuditEntry, scoreAuditValues } from './audit.service';
import { toScore, toStandings } from './mappers';
import { COLLECTIONS } from './paths';
import { publicStandingsRef, standingsRef } from './standings.service';

export interface ScoreTarget {
  readonly groupId: string;
  readonly groupName: string;
  readonly testId: string;
  readonly testName: string;
}

export type SaveScoreResult = 'created' | 'updated' | 'unchanged';

function sameValues(a: ScoreValues, b: ScoreValues): boolean {
  return a.timeMs === b.timeMs && a.penaltyMs === b.penaltyMs && a.totalMs === b.totalMs;
}

/** Desglose del grupo con un resultado cambiado (o eliminado si `result` es null). */
function withResult(
  group: StandingGroup,
  testId: string,
  result: StandingResult | null,
): StandingGroup {
  const results: Record<string, StandingResult> = { ...group.results };
  if (result) results[testId] = result;
  else delete results[testId];
  return { ...group, results };
}

function isValidDuration(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_TIME_MS;
}

@Injectable({ providedIn: 'root' })
export class ScoresService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  /** Lectura puntual (1 lectura) para precargar el formulario al editar. */
  async get(groupId: string, testId: string) {
    const snap = await getDoc(doc(this.db, COLLECTIONS.scores, scoreDocId(groupId, testId)));
    return snap.exists() ? toScore(snap) : null;
  }

  /**
   * Crea o reemplaza el resultado en una transacción que además:
   * - registra la entrada de auditoría con el valor anterior real,
   * - actualiza standings/current (desglose) y standings/public (totales).
   * Si algo falla no se escribe nada.
   *
   * @param activeTestIds pruebas activas, para recalcular el total público del grupo.
   */
  async save(
    target: ScoreTarget,
    input: ScoreInput,
    activeTestIds: ReadonlySet<string>,
  ): Promise<SaveScoreResult> {
    const actor = this.actor.requireJudge();
    if (!isValidDuration(input.timeMs) || input.timeMs === 0) {
      throw new AppError('Registra un tiempo mayor que cero.');
    }
    if (!isValidDuration(input.penaltyMs)) {
      throw new AppError('La penalización no es válida.');
    }

    const after: ScoreValues = {
      timeMs: input.timeMs,
      penaltyMs: input.penaltyMs,
      totalMs: computeTotalTime(input.timeMs, input.penaltyMs),
    };
    const scoreRef = doc(this.db, COLLECTIONS.scores, scoreDocId(target.groupId, target.testId));
    const auditRef = doc(collection(this.db, COLLECTIONS.auditLogs));

    return runTransaction(this.db, async (tx) => {
      const current = await tx.get(scoreRef);
      const standingsSnap = await tx.get(standingsRef(this.db));
      const before = current.exists() ? toScore(current) : null;
      if (before && sameValues(before, after)) {
        return 'unchanged';
      }
      const group: StandingGroup = (standingsSnap.exists()
        ? toStandings(standingsSnap).groups[target.groupId]
        : undefined) ?? { name: target.groupName, active: true, results: {} };
      const result: StandingResult = { totalMs: after.totalMs, penaltyMs: after.penaltyMs };

      tx.set(
        auditRef,
        buildAuditEntry(actor, {
          entityType: 'score',
          entityId: scoreRef.id,
          action: before ? 'update' : 'create',
          groupId: target.groupId,
          groupName: target.groupName,
          testId: target.testId,
          testName: target.testName,
          before: before ? scoreAuditValues(before) : null,
          after: scoreAuditValues(after),
        }),
      );

      // Se reescribe el documento completo (conservando createdAt) para que no
      // queden campos de versiones anteriores del modelo.
      const createdAt: unknown = current.exists() ? current.get('createdAt') : undefined;
      tx.set(scoreRef, {
        groupId: target.groupId,
        testId: target.testId,
        ...after,
        judgeId: actor.uid,
        judgeName: actor.name,
        auditId: auditRef.id,
        createdAt: createdAt instanceof Timestamp ? createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(
        standingsRef(this.db),
        {
          groups: {
            [target.groupId]: {
              results: { [target.testId]: result },
            },
          },
        },
        { merge: true },
      );
      tx.set(
        publicStandingsRef(this.db),
        {
          groups: {
            [target.groupId]: toPublicStanding(withResult(group, target.testId, result), activeTestIds),
          },
        },
        { merge: true },
      );
      return before ? 'updated' : 'created';
    });
  }

  /** Elimina un resultado (p. ej. registrado por error), con auditoría. */
  async remove(target: ScoreTarget, activeTestIds: ReadonlySet<string>): Promise<void> {
    const actor = this.actor.requireJudge();
    const scoreRef = doc(this.db, COLLECTIONS.scores, scoreDocId(target.groupId, target.testId));
    const auditRef = doc(collection(this.db, COLLECTIONS.auditLogs));

    await runTransaction(this.db, async (tx) => {
      const current = await tx.get(scoreRef);
      const standingsSnap = await tx.get(standingsRef(this.db));
      if (!current.exists()) {
        throw new AppError('Este resultado ya no existe.');
      }
      const group = standingsSnap.exists()
        ? toStandings(standingsSnap).groups[target.groupId]
        : undefined;
      const before = toScore(current);
      tx.set(
        auditRef,
        buildAuditEntry(actor, {
          entityType: 'score',
          entityId: scoreRef.id,
          action: 'delete',
          groupId: target.groupId,
          groupName: target.groupName,
          testId: target.testId,
          testName: target.testName,
          before: scoreAuditValues(before),
          after: null,
        }),
      );
      tx.delete(scoreRef);
      tx.update(
        standingsRef(this.db),
        new FieldPath('groups', target.groupId, 'results', target.testId),
        deleteField(),
      );
      if (group) {
        tx.set(
          publicStandingsRef(this.db),
          {
            groups: {
              [target.groupId]: toPublicStanding(withResult(group, target.testId, null), activeTestIds),
            },
          },
          { merge: true },
        );
      }
    });
  }
}
