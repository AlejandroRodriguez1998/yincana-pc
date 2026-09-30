import { EnvironmentProviders, InjectionToken, inject, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');

/**
 * Inicializa Firebase con el SDK modular (sin AngularFire, que no aporta
 * ventajas claras aquí y va por detrás de las versiones de Angular).
 *
 * La caché persistente de Firestore reduce lecturas facturadas al recargar
 * o reconectar, y permite ver los últimos datos con mala cobertura.
 */
export function provideFirebase(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useFactory: () => initializeApp(environment.firebase) },
    { provide: FIREBASE_AUTH, useFactory: () => getAuth(inject(FIREBASE_APP)) },
    {
      provide: FIRESTORE,
      useFactory: () =>
        initializeFirestore(inject(FIREBASE_APP), {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        }),
    },
  ]);
}
