import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** Hora actual (epoch ms) que se refresca cada `intervalMs`. Se detiene con el contexto. */
export function injectNow(intervalMs = 15_000): Signal<number> {
  const now = signal(Date.now());
  const id = setInterval(() => now.set(Date.now()), intervalMs);
  const onVisible = () => now.set(Date.now());
  document.addEventListener('visibilitychange', onVisible);
  inject(DestroyRef).onDestroy(() => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
  });
  return now.asReadonly();
}

/** "ahora mismo", "hace 3 min", "hace 1 h 05 min". */
export function sinceLabel(from: Date | null, now: number): string {
  const minutes = from ? Math.floor(Math.max(0, now - from.getTime()) / 60_000) : 0;
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
