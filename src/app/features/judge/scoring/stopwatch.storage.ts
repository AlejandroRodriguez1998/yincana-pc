import { Injectable } from '@angular/core';

/**
 * Estado persistente del cronómetro. El tiempo se calcula siempre a partir de
 * timestamps (Date.now()), nunca contando ticks, así que no se pierde precisión
 * si la pestaña se congela, el móvil se bloquea o se recarga la página.
 */
export interface StopwatchState {
  /** Tiempo acumulado de tramos ya pausados. */
  readonly accumulatedMs: number;
  /** Instante (epoch ms) en que arrancó el tramo actual; null si está parado. */
  readonly startedAt: number | null;
}

const PREFIX = 'yincana.stopwatch.';
const EMPTY: StopwatchState = { accumulatedMs: 0, startedAt: null };

export function elapsedMs(state: StopwatchState, now: number): number {
  const running = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt);
  return state.accumulatedMs + running;
}

@Injectable({ providedIn: 'root' })
export class StopwatchStorage {
  load(key: string): StopwatchState {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return EMPTY;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return EMPTY;
      const accumulated = Reflect.get(parsed, 'accumulatedMs');
      const startedAt = Reflect.get(parsed, 'startedAt');
      return {
        accumulatedMs: typeof accumulated === 'number' && accumulated >= 0 ? accumulated : 0,
        startedAt: typeof startedAt === 'number' ? startedAt : null,
      };
    } catch {
      return EMPTY;
    }
  }

  save(key: string, state: StopwatchState): void {
    try {
      if (state.accumulatedMs === 0 && state.startedAt === null) {
        localStorage.removeItem(PREFIX + key);
      } else {
        localStorage.setItem(PREFIX + key, JSON.stringify(state));
      }
    } catch {
      // Sin almacenamiento el cronómetro sigue funcionando, pero solo en memoria.
    }
  }

  clear(key: string): void {
    this.save(key, EMPTY);
  }
}
