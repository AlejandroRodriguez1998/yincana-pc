export type UserRole = 'judge' | 'group';

/** Documento users/{uid}. Solo los jueces pueden escribirlo (ver firestore.rules). */
export interface UserProfile {
  readonly uid: string;
  readonly role: UserRole;
  /** Grupo al que pertenece la cuenta. Siempre null para jueces. */
  readonly groupId: string | null;
  readonly displayName: string;
  /** Nombre de usuario con el que se inicia sesión (parte local del email interno). */
  readonly username: string;
  readonly createdAt: Date | null;
}
