import { Injectable, inject } from '@angular/core';
import {
  FieldValue,
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { Test, TestInput } from '../models';
import { ActorService } from './actor';
import { buildAuditEntry } from './audit.service';
import { toScore } from './mappers';
import { COLLECTIONS } from './paths';
import { readStandings, standingsRef, writePublic } from './standings.service';

function normalize(input: TestInput): TestInput {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    order: Math.trunc(input.order),
    active: input.active,
  };
}

/** Campos de la versión con puntos: se eliminan al editar pruebas antiguas. */
const LEGACY_FIELDS = { maxScore: deleteField(), usesTimer: deleteField() };

/** Pruebas activas tras aplicar un cambio de estado a una de ellas. */
function activeIdsAfter(tests: readonly Test[], changedId: string, active: boolean): Set<string> {
  const ids = new Set(tests.filter((t) => t.active).map((t) => t.id));
  if (active) ids.add(changedId);
  else ids.delete(changedId);
  return ids;
}

/**
 * Cambiar qué pruebas están activas cambia los totales de todos los grupos,
 * así que en esos casos se recalcula standings/public en el mismo lote.
 */
@Injectable({ providedIn: 'root' })
export class TestsService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  async create(input: TestInput): Promise<string> {
    this.actor.requireJudge();
    const ref = await addDoc(collection(this.db, COLLECTIONS.tests), {
      ...normalize(input),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  /** @param tests lista actual de pruebas (para recalcular totales si cambia `active`). */
  async update(id: string, input: TestInput, tests: readonly Test[]): Promise<void> {
    this.actor.requireJudge();
    const previous = tests.find((t) => t.id === id);
    const batch = writeBatch(this.db);
    batch.update(doc(this.db, COLLECTIONS.tests, id), {
      ...normalize(input),
      ...LEGACY_FIELDS,
      updatedAt: serverTimestamp(),
    });
    if (previous?.active !== input.active) {
      writePublic(this.db, batch, await readStandings(this.db), activeIdsAfter(tests, id, input.active));
    }
    await batch.commit();
  }

  async setActive(test: Test, active: boolean, tests: readonly Test[]): Promise<void> {
    this.actor.requireJudge();
    const standings = await readStandings(this.db);
    const batch = writeBatch(this.db);
    batch.update(doc(this.db, COLLECTIONS.tests, test.id), {
      active,
      ...LEGACY_FIELDS,
      updatedAt: serverTimestamp(),
    });
    writePublic(this.db, batch, standings, activeIdsAfter(tests, test.id, active));
    await batch.commit();
  }

  /** Intercambia el orden de dos pruebas en un lote atómico. */
  async swapOrder(a: Test, b: Test): Promise<void> {
    this.actor.requireJudge();
    const batch = writeBatch(this.db);
    const orderA = a.order === b.order ? a.order + 1 : b.order;
    batch.update(doc(this.db, COLLECTIONS.tests, a.id), {
      order: orderA,
      ...LEGACY_FIELDS,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(this.db, COLLECTIONS.tests, b.id), {
      order: a.order,
      ...LEGACY_FIELDS,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }

  /** Borra la prueba y todos sus resultados, y la quita del resumen. */
  async delete(test: Test, tests: readonly Test[]): Promise<number> {
    const actor = this.actor.requireJudge();
    const [scoresSnap, standings] = await Promise.all([
      getDocs(query(collection(this.db, COLLECTIONS.scores), where('testId', '==', test.id))),
      readStandings(this.db),
    ]);

    const batch = writeBatch(this.db);
    const groupResults: Record<string, { results: Record<string, FieldValue> }> = {};
    for (const snap of scoresSnap.docs) {
      batch.delete(snap.ref);
      groupResults[toScore(snap).groupId] = { results: { [test.id]: deleteField() } };
    }
    batch.delete(doc(this.db, COLLECTIONS.tests, test.id));
    if (scoresSnap.size > 0) {
      batch.set(standingsRef(this.db), { groups: groupResults }, { merge: true });
    }
    writePublic(this.db, batch, standings, activeIdsAfter(tests, test.id, false));
    batch.set(
      doc(collection(this.db, COLLECTIONS.auditLogs)),
      buildAuditEntry(actor, {
        entityType: 'test',
        entityId: test.id,
        action: 'delete',
        testId: test.id,
        testName: test.name,
        note: `Prueba eliminada con ${scoresSnap.size} resultados.`,
      }),
    );
    await batch.commit();
    return scoresSnap.size;
  }
}
