import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { Group, GroupInput, Participant } from '../models';
import { ActorService } from './actor';
import { buildAuditEntry } from './audit.service';
import { COLLECTIONS } from './paths';
import { publicStandingsRef, standingsRef } from './standings.service';

function cleanParticipants(participants: readonly Participant[]): Participant[] {
  return participants
    .map((p) => ({ id: p.id, name: p.name.trim() }))
    .filter((p) => p.name.length > 0);
}

export function newParticipantId(): string {
  return crypto.randomUUID().slice(0, 8);
}

@Injectable({ providedIn: 'root' })
export class GroupsService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  /** Crea el grupo y su entrada en el resumen de la competición (lote atómico). */
  async create(input: GroupInput): Promise<string> {
    this.actor.requireJudge();
    const ref = doc(collection(this.db, COLLECTIONS.groups));
    const name = input.name.trim();
    const batch = writeBatch(this.db);
    batch.set(ref, {
      name,
      participants: cleanParticipants(input.participants),
      active: input.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(
      standingsRef(this.db),
      { groups: { [ref.id]: { name, active: input.active, results: {} } } },
      { merge: true },
    );
    batch.set(
      publicStandingsRef(this.db),
      { groups: { [ref.id]: { name, active: input.active, totalMs: 0, completed: 0 } } },
      { merge: true },
    );
    await batch.commit();
    return ref.id;
  }

  async update(id: string, input: GroupInput): Promise<void> {
    this.actor.requireJudge();
    const name = input.name.trim();
    const batch = writeBatch(this.db);
    batch.update(doc(this.db, COLLECTIONS.groups, id), {
      name,
      participants: cleanParticipants(input.participants),
      active: input.active,
      updatedAt: serverTimestamp(),
    });
    // merge: solo cambia nombre/estado, conserva resultados y totales.
    batch.set(
      standingsRef(this.db),
      { groups: { [id]: { name, active: input.active } } },
      { merge: true },
    );
    batch.set(
      publicStandingsRef(this.db),
      { groups: { [id]: { name, active: input.active } } },
      { merge: true },
    );
    await batch.commit();
  }

  /**
   * Borra el grupo, sus resultados y los accesos (perfiles) vinculados.
   * Las cuentas de Authentication quedan sin permisos; eliminarlas del todo
   * requiere Firebase Console (el SDK cliente no puede borrar otros usuarios).
   */
  async delete(group: Group): Promise<{ scores: number; accounts: number }> {
    const actor = this.actor.requireJudge();
    const [scoresSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(this.db, COLLECTIONS.scores), where('groupId', '==', group.id))),
      getDocs(query(collection(this.db, COLLECTIONS.users), where('groupId', '==', group.id))),
    ]);

    const batch = writeBatch(this.db);
    scoresSnap.docs.forEach((d) => batch.delete(d.ref));
    usersSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(this.db, COLLECTIONS.groups, group.id));
    batch.set(standingsRef(this.db), { groups: { [group.id]: deleteField() } }, { merge: true });
    batch.set(
      publicStandingsRef(this.db),
      { groups: { [group.id]: deleteField() } },
      { merge: true },
    );
    batch.set(
      doc(collection(this.db, COLLECTIONS.auditLogs)),
      buildAuditEntry(actor, {
        entityType: 'group',
        entityId: group.id,
        action: 'delete',
        groupId: group.id,
        groupName: group.name,
        note: `Grupo eliminado con ${scoresSnap.size} resultados y ${usersSnap.size} accesos.`,
      }),
    );
    await batch.commit();
    return { scores: scoresSnap.size, accounts: usersSnap.size };
  }
}
