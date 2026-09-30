import { Injectable, inject } from '@angular/core';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { AppError } from '../firebase/errors';
import { FIRESTORE } from '../firebase/firebase.providers';
import { UserProfile } from '../models';
import { ActorService } from './actor';
import { toUserProfile } from './mappers';
import { COLLECTIONS } from './paths';

/** Gestión de perfiles (users/{uid}). Lecturas puntuales, sin listeners. */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  async listJudges(): Promise<UserProfile[]> {
    const snap = await getDocs(
      query(collection(this.db, COLLECTIONS.users), where('role', '==', 'judge')),
    );
    return snap.docs.map(toUserProfile).sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
  }

  async listGroupAccounts(groupId: string): Promise<UserProfile[]> {
    const snap = await getDocs(
      query(collection(this.db, COLLECTIONS.users), where('groupId', '==', groupId)),
    );
    return snap.docs.map(toUserProfile).sort((a, b) => a.username.localeCompare(b.username, 'es'));
  }

  /**
   * Retira el acceso borrando el perfil. La cuenta de Authentication sigue
   * existiendo pero ya no tiene ningún permiso (ver firestore.rules).
   */
  async revokeAccess(uid: string): Promise<void> {
    const actor = this.actor.requireJudge();
    if (uid === actor.uid) {
      throw new AppError('No puedes retirarte el acceso a ti mismo.');
    }
    await deleteDoc(doc(this.db, COLLECTIONS.users, uid));
  }
}
