import { DestroyRef, Injector, Signal, effect, inject, signal, untracked } from '@angular/core';
import {
  DocumentReference,
  DocumentSnapshot,
  Query,
  QueryDocumentSnapshot,
  Unsubscribe,
  onSnapshot,
} from 'firebase/firestore';
import { describeError } from './errors';

/** Estado de un listener de Firestore expuesto como signals. */
export interface LiveResource<T> {
  readonly value: Signal<T>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
}

/**
 * Escucha una consulta en tiempo real. El listener se cancela automáticamente
 * cuando se destruye el contexto (componente o store) que lo creó.
 */
export function liveQuery<T>(
  query: Query,
  map: (doc: QueryDocumentSnapshot) => T,
  destroyRef: DestroyRef = inject(DestroyRef),
): LiveResource<readonly T[]> {
  const value = signal<readonly T[]>([]);
  const loading = signal(true);
  const error = signal<string | null>(null);

  const unsubscribe = onSnapshot(
    query,
    (snapshot) => {
      value.set(snapshot.docs.map(map));
      loading.set(false);
      error.set(null);
    },
    (err) => {
      error.set(describeError(err, 'No se han podido cargar los datos.'));
      loading.set(false);
    },
  );
  destroyRef.onDestroy(unsubscribe);

  return { value: value.asReadonly(), loading: loading.asReadonly(), error: error.asReadonly() };
}

/** Escucha un documento en tiempo real. `value` es null si el documento no existe. */
export function liveDoc<T>(
  ref: DocumentReference,
  map: (snapshot: DocumentSnapshot) => T | null,
  destroyRef: DestroyRef = inject(DestroyRef),
): LiveResource<T | null> {
  const value = signal<T | null>(null);
  const loading = signal(true);
  const error = signal<string | null>(null);

  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      value.set(snapshot.exists() ? map(snapshot) : null);
      loading.set(false);
      error.set(null);
    },
    (err) => {
      error.set(describeError(err, 'No se han podido cargar los datos.'));
      loading.set(false);
    },
  );
  destroyRef.onDestroy(unsubscribe);

  return { value: value.asReadonly(), loading: loading.asReadonly(), error: error.asReadonly() };
}

/**
 * Como liveDoc, pero el listener solo existe mientras `enabled` es true.
 * Se usa cuando las reglas solo permiten leer el documento en ciertos estados
 * (p. ej. el ranking público, solo cuando está revelado).
 */
export function liveDocWhen<T>(
  enabled: Signal<boolean>,
  ref: DocumentReference,
  map: (snapshot: DocumentSnapshot) => T | null,
  injector: Injector = inject(Injector),
): LiveResource<T | null> {
  const value = signal<T | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);
  let unsubscribe: Unsubscribe | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retries = 0;

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const listen = () => {
    unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        retries = 0;
        value.set(snapshot.exists() ? map(snapshot) : null);
        loading.set(false);
        error.set(null);
      },
      (err) => {
        unsubscribe = null;
        // Si las reglas dependen de la hora (p. ej. revelado diferido), un pequeño
        // desfase de reloj puede provocar un rechazo: se reintenta unas veces.
        if (err.code === 'permission-denied' && retries < 5 && enabled()) {
          retries += 1;
          retryTimer = setTimeout(listen, 2_000);
          return;
        }
        error.set(describeError(err, 'No se han podido cargar los datos.'));
        loading.set(false);
      },
    );
  };

  effect(
    () => {
      const on = enabled();
      untracked(() => {
        stop();
        value.set(null);
        error.set(null);
        loading.set(on);
        retries = 0;
        if (on) listen();
      });
    },
    { injector },
  );
  injector.get(DestroyRef).onDestroy(stop);

  return { value: value.asReadonly(), loading: loading.asReadonly(), error: error.asReadonly() };
}
