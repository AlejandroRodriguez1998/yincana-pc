import { AppEnvironment } from './environment.model';

/**
 * Configuración de producción.
 * La configuración web de Firebase es pública por diseño: la seguridad real
 * la imponen las reglas de Firestore (firestore.rules), no el secreto de estas claves.
 */
export const environment: AppEnvironment = {
  production: true,
  firebase: {
    apiKey: 'AIzaSyDn94AUw-1KykTqJoV4j9SPM7rvAwX7rHU',
    authDomain: 'yincana-pc.firebaseapp.com',
    projectId: 'yincana-pc',
    storageBucket: 'yincana-pc.firebasestorage.app',
    messagingSenderId: '595522559696',
    appId: '1:595522559696:web:be64ebac8bda61189348d5',
  },
  accountEmailDomain: 'cuentas.yincana-pc.firebaseapp.com',
};
