import { Injectable, inject } from '@angular/core';
import {
  DocumentReference,
  Firestore,
  WriteBatch,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { PublicStanding, StandingResult, Standings } from '../models';
import { toPublicStanding } from '../ranking/ranking';
import { ActorService } from './actor';
import { toGroup, toScore, toStandings } from './mappers';
import { COLLECTIONS, PUBLIC_STANDINGS_DOC_ID, STANDINGS_DOC_ID } from './paths';

/** standings/current: desglose completo (solo jueces). */
export function standingsRef(db: Firestore): DocumentReference {
  return doc(db, COLLECTIONS.standings, STANDINGS_DOC_ID);
}

/** standings/public: totales por grupo (jueces y grupos). */
export function publicStandingsRef(db: Firestore): DocumentReference {
  return doc(db, COLLECTIONS.standings, PUBLIC_STANDINGS_DOC_ID);
}

/** Calcula todas las entradas públicas a partir del desglose. */
export function publicFromStandings(
  standings: Standings,
  activeTestIds: ReadonlySet<string>,
): Record<string, PublicStanding> {
  return Object.fromEntries(
    Object.entries(standings.groups).map(([groupId, group]) => [
      groupId,
      toPublicStanding(group, activeTestIds),
    ]),
  );
}

export async function readStandings(db: Firestore): Promise<Standings> {
  const snap = await getDoc(standingsRef(db));
  return snap.exists() ? toStandings(snap) : { groups: {} };
}

/**
 * Reescribe standings/public entero dentro de un lote (p. ej. al activar o
 * desactivar pruebas, que cambia los totales de todos los grupos).
 */
export function writePublic(
  db: Firestore,
  batch: WriteBatch,
  standings: Standings,
  activeTestIds: ReadonlySet<string>,
): void {
  batch.set(publicStandingsRef(db), {
    groups: publicFromStandings(standings, activeTestIds),
    updatedAt: serverTimestamp(),
  });
}

@Injectable({ providedIn: 'root' })
export class StandingsService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  /**
   * Reconstruye standings/current y standings/public a partir de groups y scores.
   * Normalmente no hace falta (se mantienen en cada escritura), pero sirve
   * como herramienta de reparación. Coste: 1 lectura por grupo y por resultado.
   */
  async rebuild(activeTestIds: ReadonlySet<string>): Promise<void> {
    this.actor.requireJudge();
    const [groupsSnap, scoresSnap] = await Promise.all([
      getDocs(collection(this.db, COLLECTIONS.groups)),
      getDocs(collection(this.db, COLLECTIONS.scores)),
    ]);

    const groups: Record<
      string,
      { name: string; active: boolean; results: Record<string, StandingResult> }
    > = {};
    for (const snap of groupsSnap.docs) {
      const group = toGroup(snap);
      groups[group.id] = { name: group.name, active: group.active, results: {} };
    }
    for (const snap of scoresSnap.docs) {
      const score = toScore(snap);
      const target = groups[score.groupId];
      // totalMs = 0 indica un documento del formato antiguo (por puntos): se ignora.
      if (target && score.totalMs > 0) {
        target.results[score.testId] = { totalMs: score.totalMs, penaltyMs: score.penaltyMs };
      }
    }

    // Sobrescritura completa (sin merge): elimina restos de grupos/pruebas borrados.
    const batch = writeBatch(this.db);
    batch.set(standingsRef(this.db), { groups, updatedAt: serverTimestamp() });
    writePublic(this.db, batch, { groups }, activeTestIds);
    await batch.commit();
  }
}

