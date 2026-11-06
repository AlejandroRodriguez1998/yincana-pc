import { Injectable, inject } from '@angular/core';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { inProgressDocId } from '../models';
import { ActorService } from './actor';
import { COLLECTIONS } from './paths';

export interface InProgressTarget {
  readonly groupId: string;
  readonly groupName: string;
  readonly testId: string;
}

/**
 * Marca qué grupo está haciendo qué prueba, para que grupos y jueces vean en
 * directo qué pruebas están libres u ocupadas.
 *
 * Es información de apoyo: si una escritura falla no se interrumpe el
 * cronometraje (el error solo se registra en consola).
 */
@Injectable({ providedIn: 'root' })
export class InProgressService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  /** El grupo empieza la prueba: la prueba pasa a estar ocupada. */
  start(target: InProgressTarget): void {
    const actor = this.actor.requireJudge();
    const ref = doc(this.db, COLLECTIONS.inProgress, inProgressDocId(target.groupId, target.testId));
    setDoc(ref, {
      groupId: target.groupId,
      testId: target.testId,
      groupName: target.groupName,
      judgeId: actor.uid,
      judgeName: actor.name,
      startedAt: serverTimestamp(),
    }).catch((err: unknown) => console.warn('No se ha podido marcar la prueba como ocupada.', err));
  }

  /** El grupo termina o abandona la prueba: deja de ocuparla. */
  finish(groupId: string, testId: string): Promise<void> {
    this.actor.requireJudge();
    const ref = doc(this.db, COLLECTIONS.inProgress, inProgressDocId(groupId, testId));
    return deleteDoc(ref).catch((err: unknown) => {
      console.warn('No se ha podido liberar la prueba.', err);
      throw err;
    });
  }

  /** Igual que finish, pero sin propagar errores (para limpiezas automáticas). */
  finishQuietly(groupId: string, testId: string): void {
    this.finish(groupId, testId).catch(() => undefined);
  }
}
