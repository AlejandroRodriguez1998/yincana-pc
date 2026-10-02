import { Injectable, inject } from '@angular/core';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import {
  collection,
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
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.providers';
import { JUDGE_NAME_MAX, JUDGE_PASSWORD_MIN, JudgeRequest, JudgeRequestStatus } from '../models';
import { ActorService } from './actor';
import { toJudgeRequest } from './mappers';
import { COLLECTIONS } from './paths';

/**
 * Altas de jueces bajo aprobación.
 *
 * 1. El profesor se registra en /alta-jueces: se crea su cuenta de Authentication
 *    y su solicitud judgeRequests/{uid} (estado "pending").
 * 2. Cualquier juez la aprueba (crea users/{uid} con rol juez) o la rechaza.
 *
 * Sin perfil en users/{uid}, la cuenta no tiene ningún permiso (firestore.rules).
 */
@Injectable({ providedIn: 'root' })
export class JudgeRequestsService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  /** Registra la cuenta y envía la solicitud. Al terminar, cierra la sesión. */
  async submit(input: { displayName: string; email: string; password: string }): Promise<void> {
    const displayName = input.displayName.trim();
    const email = input.email.trim().toLowerCase();
    if (!displayName || displayName.length > JUDGE_NAME_MAX) {
      throw new AppError('Escribe tu nombre (máx. 80 caracteres).');
    }
    if (input.password.length < JUDGE_PASSWORD_MIN) {
      throw new AppError(`La contraseña debe tener al menos ${JUDGE_PASSWORD_MIN} caracteres.`);
    }

    const credential = await createUserWithEmailAndPassword(this.auth, email, input.password);
    try {
      await setDoc(doc(this.db, COLLECTIONS.judgeRequests, credential.user.uid), {
        displayName,
        // El email tal como lo guarda Auth: las reglas lo comparan con el del token.
        email: credential.user.email ?? email,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      // Sin solicitud la cuenta no serviría y el email quedaría ocupado: se elimina.
      await deleteUser(credential.user).catch(() => undefined);
      throw error;
    } finally {
      await signOut(this.auth).catch(() => undefined);
    }
  }

  /** Estado de la solicitud del usuario con sesión (o null si no hay solicitud). */
  async statusOf(uid: string): Promise<JudgeRequestStatus | null> {
    try {
      const snap = await getDoc(doc(this.db, COLLECTIONS.judgeRequests, uid));
      return snap.exists() ? toJudgeRequest(snap).status : null;
    } catch {
      return null;
    }
  }

  /** Solicitudes pendientes (lectura puntual, sin listener). */
  async listPending(): Promise<JudgeRequest[]> {
    this.actor.requireJudge();
    const snap = await getDocs(
      query(collection(this.db, COLLECTIONS.judgeRequests), where('status', '==', 'pending')),
    );
    return snap.docs
      .map(toJudgeRequest)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  /** Aprueba: crea el perfil de juez y elimina la solicitud (lote atómico). */
  async approve(request: JudgeRequest): Promise<void> {
    this.actor.requireJudge();
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, COLLECTIONS.users, request.uid), {
      role: 'judge',
      groupId: null,
      displayName: request.displayName,
      username: request.email,
      createdAt: serverTimestamp(),
    });
    batch.delete(doc(this.db, COLLECTIONS.judgeRequests, request.uid));
    await batch.commit();
  }

  /**
   * Rechaza: la solicitud queda marcada como rechazada (no se borra), así la
   * misma cuenta no puede volver a solicitar el alta.
   */
  async reject(request: JudgeRequest): Promise<void> {
    const actor = this.actor.requireJudge();
    await updateDoc(doc(this.db, COLLECTIONS.judgeRequests, request.uid), {
      status: 'rejected',
      reviewedBy: actor.uid,
      reviewedAt: serverTimestamp(),
    });
  }
}
