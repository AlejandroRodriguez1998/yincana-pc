import { environment } from '../../../environments/environment';

/** Usuario: minúsculas, números, punto, guion y guion bajo; 3 a 30 caracteres. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/**
 * Las cuentas usan Email/Password de Firebase con un email interno
 * construido a partir del nombre de usuario. Si se escribe un email completo
 * (por ejemplo, el del primer juez creado en la consola) se usa tal cual.
 */
export function toAccountEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${environment.accountEmailDomain}`;
}

/** Propone un nombre de usuario a partir de un nombre: "Grupo Ñandú 3" → "grupo-nandu-3". */
export function suggestUsername(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

/** Contraseña fácil de dictar (sin caracteres ambiguos). */
export function generatePassword(length = 8): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
