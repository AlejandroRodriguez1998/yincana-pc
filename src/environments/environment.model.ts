import { FirebaseOptions } from 'firebase/app';

export interface AppEnvironment {
  readonly production: boolean;
  readonly firebase: FirebaseOptions;
  /**
   * Dominio con el que se construye el email interno de las cuentas creadas
   * desde la app (usuario "grupo1" → "grupo1@<dominio>"). Nunca se envían emails.
   */
  readonly accountEmailDomain: string;
}
