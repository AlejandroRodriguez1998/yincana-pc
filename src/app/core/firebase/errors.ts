import { FirebaseError } from 'firebase/app';

/** Error de la aplicación cuyo mensaje ya es apto para mostrar al usuario. */
export class AppError extends Error {
  override readonly name = 'AppError';
}

const MESSAGES: Readonly<Record<string, string>> = {
  'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
  'auth/wrong-password': 'Usuario o contraseña incorrectos.',
  'auth/user-not-found': 'Usuario o contraseña incorrectos.',
  'auth/invalid-email': 'El nombre de usuario no es válido.',
  'auth/missing-password': 'Introduce la contraseña.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  'auth/network-request-failed': 'Sin conexión. Comprueba la red y vuelve a intentarlo.',
  'auth/email-already-in-use': 'Ese nombre de usuario ya está en uso.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/operation-not-allowed':
    'El acceso con usuario y contraseña no está habilitado en Firebase Authentication.',
  'permission-denied': 'No tienes permiso para realizar esta operación.',
  unavailable: 'Sin conexión con el servidor. No se ha guardado nada; vuelve a intentarlo.',
  'deadline-exceeded': 'El servidor ha tardado demasiado. Vuelve a intentarlo.',
  aborted: 'Otro juez estaba guardando a la vez. Vuelve a intentarlo.',
  'not-found': 'El elemento ya no existe.',
  'failed-precondition': 'La operación no se puede realizar en el estado actual.',
  'resource-exhausted': 'Se ha alcanzado el límite de uso gratuito de Firebase por hoy.',
};

export function describeError(error: unknown, fallback = 'Ha ocurrido un error inesperado.'): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? `${fallback} (${error.code})`;
  }
  return fallback;
}
