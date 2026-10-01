import { Injectable, computed, inject, signal } from '@angular/core';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  Unsubscribe,
  clearIndexedDbPersistence,
  doc,
  onSnapshot,
  terminate,
} from 'firebase/firestore';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.providers';
import { toUserProfile } from '../data/mappers';
import { COLLECTIONS } from '../data/paths';
import { UserProfile } from '../models';
import { toAccountEmail } from './account-email';

/**
 * - loading: resolviendo sesión o perfil.
 * - signedOut: sin sesión.
 * - noProfile: sesión válida pero sin documento users/{uid} (sin permisos).
 * - ready: sesión y perfil cargados.
 */
export type AuthStatus = 'loading' | 'signedOut' | 'noProfile' | 'ready';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly db = inject(FIRESTORE);

  private readonly _status = signal<AuthStatus>('loading');
  private readonly _user = signal<User | null>(null);
  private readonly _profile = signal<UserProfile | null>(null);
  private profileUnsubscribe: Unsubscribe | null = null;
  private waiters: Array<() => void> = [];

  readonly status = this._status.asReadonly();
  readonly user = this._user.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly isJudge = computed(() => this._profile()?.role === 'judge');
  readonly isGroup = computed(() => this._profile()?.role === 'group');

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.handleUser(user));
  }

  /** Resuelve cuando el estado de autenticación ya no es "loading". */
  whenResolved(): Promise<AuthStatus> {
    return this.waitFor(() => this._status() !== 'loading');
  }

  async login(identifier: string, password: string): Promise<AuthStatus> {
    const credential = await signInWithEmailAndPassword(
      this.auth,
      toAccountEmail(identifier),
      password,
    );
    const uid = credential.user.uid;
    return this.waitFor(() => this._user()?.uid === uid && this._status() !== 'loading');
  }

  /** Cierra la sesión sin recargar (p. ej. cuenta sin perfil en el login). */
  async signOutOnly(): Promise<void> {
    await signOut(this.auth);
  }

  /**
   * Cierra sesión y limpia la caché local de Firestore (los móviles pueden
   * ser compartidos). Se recarga la página para empezar desde cero.
   */
  async logout(): Promise<void> {
    this.profileUnsubscribe?.();
    this.profileUnsubscribe = null;
    try {
      await terminate(this.db);
      await clearIndexedDbPersistence(this.db);
    } catch {
      // Si otra pestaña mantiene la caché abierta no se puede borrar; no es crítico.
    }
    await signOut(this.auth);
    window.location.replace('/');
  }

  private handleUser(user: User | null): void {
    this.profileUnsubscribe?.();
    this.profileUnsubscribe = null;
    this._user.set(user);

    if (!user) {
      this._profile.set(null);
      this.setStatus('signedOut');
      return;
    }

    this.setStatus('loading');
    // Listener sobre el propio perfil (1 lectura): si un juez retira el acceso,
    // la sesión deja de tener permisos inmediatamente.
    this.profileUnsubscribe = onSnapshot(
      doc(this.db, COLLECTIONS.users, user.uid),
      (snapshot) => {
        this._profile.set(snapshot.exists() ? toUserProfile(snapshot) : null);
        this.setStatus(snapshot.exists() ? 'ready' : 'noProfile');
      },
      () => {
        this._profile.set(null);
        this.setStatus('noProfile');
      },
    );
  }

  private setStatus(status: AuthStatus): void {
    this._status.set(status);
    const pending = this.waiters;
    this.waiters = [];
    pending.forEach((check) => check());
  }

  private waitFor(predicate: () => boolean): Promise<AuthStatus> {
    return new Promise((resolve) => {
      const check = () => {
        if (predicate()) {
          resolve(this._status());
        } else {
          this.waiters.push(check);
        }
      };
      check();
    });
  }
}
