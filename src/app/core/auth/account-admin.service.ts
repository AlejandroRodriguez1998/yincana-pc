import { Injectable, inject } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  createUserWithEmailAndPassword,
  deleteUser,
  inMemoryPersistence,
  initializeAuth,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { AppError } from '../firebase/errors';
import { FIRESTORE } from '../firebase/firebase.providers';
import { COLLECTIONS } from '../data/paths';
import { UserRole } from '../models';
import { USERNAME_PATTERN, toAccountEmail } from './account-email';

const SECONDARY_APP_NAME = 'account-admin';

export interface NewAccount {
  readonly username: string;
  readonly password: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly groupId: string | null;
}

export interface CreatedAccount {
  readonly uid: string;
  readonly username: string;
  readonly password: string;
}

/**
 * Crea cuentas de Firebase Authentication desde el navegador de un juez.
 *
 * El SDK cliente no puede crear usuarios "para otros" sin iniciar sesión como
 * ellos, así que se usa una segunda instancia de Firebase con persistencia en
 * memoria: la sesión del juez no se toca. El Admin SDK (Cloud Functions) sería
 * la alternativa, pero requiere el plan Blaze.
 *
 * Es seguro porque una cuenta de Auth por sí sola no tiene ningún permiso:
 * el acceso lo concede el documento users/{uid}, que solo pueden escribir
 * los jueces según firestore.rules.
 */
@Injectable({ providedIn: 'root' })
export class AccountAdminService {
  private readonly db = inject(FIRESTORE);
  private secondaryAuth: Auth | null = null;

  async createAccount(input: NewAccount): Promise<CreatedAccount> {
    const username = input.username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      throw new AppError(
        'Usuario no válido: 3-30 caracteres en minúscula, números, punto, guion o guion bajo.',
      );
    }

    const auth = this.getSecondaryAuth();
    const credential = await createUserWithEmailAndPassword(
      auth,
      toAccountEmail(username),
      input.password,
    );

    try {
      await setDoc(doc(this.db, COLLECTIONS.users, credential.user.uid), {
        role: input.role,
        groupId: input.role === 'group' ? input.groupId : null,
        displayName: input.displayName.trim(),
        username,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      // Sin perfil la cuenta no tendría permisos, pero la eliminamos para
      // no dejar el nombre de usuario ocupado.
      await deleteUser(credential.user).catch(() => undefined);
      throw error;
    } finally {
      await signOut(auth).catch(() => undefined);
    }

    return { uid: credential.user.uid, username, password: input.password };
  }

  private getSecondaryAuth(): Auth {
    if (!this.secondaryAuth) {
      const app: FirebaseApp =
        getApps().find((a) => a.name === SECONDARY_APP_NAME) ??
        initializeApp(environment.firebase, SECONDARY_APP_NAME);
      this.secondaryAuth = initializeAuth(app, { persistence: inMemoryPersistence });
    }
    return this.secondaryAuth;
  }
}
