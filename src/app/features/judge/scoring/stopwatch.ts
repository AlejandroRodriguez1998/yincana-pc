import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { StopwatchState, StopwatchStorage, elapsedMs } from './stopwatch.storage';

/**
 * Cronómetro con controles grandes. El intervalo solo refresca la pantalla;
 * el tiempo real sale de timestamps guardados en localStorage.
 */
@Component({
  selector: 'app-stopwatch',
  imports: [Icon, DurationPipe],
  template: `
    <div class="stopwatch" [class.running]="running()">
      <div class="readout mono" role="timer" aria-live="off" [attr.aria-label]="'Cronómetro ' + (elapsed() | duration)">
        {{ elapsed() | duration }}
      </div>
      <div class="state small">
        @if (running()) {
          <span class="dot"></span> En marcha
        } @else if (elapsed() > 0) {
          En pausa
        } @else {
          Listo
        }
      </div>
      <div class="controls">
        @if (running()) {
          <button type="button" class="btn btn-lg btn-warning grow" (click)="pause()">
            <app-icon name="pause" [size]="22" /> Pausar
          </button>
        } @else {
          <button type="button" class="btn btn-lg btn-accent grow" (click)="start()">
            <app-icon name="play" [size]="22" /> {{ elapsed() > 0 ? 'Reanudar' : 'Iniciar' }}
          </button>
          @if (elapsed() > 0) {
            <button type="button" class="btn btn-lg btn-outline" (click)="reset()" aria-label="Reiniciar cronómetro">
              <app-icon name="reset" [size]="22" />
            </button>
          }
        }
      </div>
    </div>
  `,
  styleUrl: './stopwatch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stopwatch {
  private readonly storage = inject(StopwatchStorage);

  /** Clave única por grupo y prueba: cada combinación tiene su propio cronómetro. */
  readonly storageKey = input.required<string>();
  /** Emite el tiempo al pausar (ms) o null al reiniciar. */
  readonly captured = output<number | null>();

  private readonly state = signal<StopwatchState>({ accumulatedMs: 0, startedAt: null });
  private readonly now = signal(Date.now());
  private intervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly running = computed(() => this.state().startedAt !== null);
  protected readonly elapsed = computed(() => elapsedMs(this.state(), this.now()));

  constructor() {
    effect(() => {
      const key = this.storageKey();
      untracked(() => {
        this.state.set(this.storage.load(key));
        this.now.set(Date.now());
        this.syncTicker();
      });
    });

    const onVisibility = () => this.now.set(Date.now());
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.stopTicker();
    });
  }

  start(): void {
    if (this.running()) return;
    this.update({ ...this.state(), startedAt: Date.now() });
  }

  pause(): number {
    const now = Date.now();
    const total = elapsedMs(this.state(), now);
    this.update({ accumulatedMs: total, startedAt: null });
    this.captured.emit(total);
    return total;
  }

  reset(): void {
    this.update({ accumulatedMs: 0, startedAt: null });
    this.captured.emit(null);
  }

  /** Si está en marcha, lo pausa y devuelve el tiempo; si no, devuelve null. */
  captureIfRunning(): number | null {
    return this.running() ? this.pause() : null;
  }

  /** Olvida el cronómetro de esta combinación (tras guardar el resultado). */
  clear(): void {
    this.update({ accumulatedMs: 0, startedAt: null });
  }

  private update(state: StopwatchState): void {
    this.state.set(state);
    this.now.set(Date.now());
    this.storage.save(this.storageKey(), state);
    this.syncTicker();
  }

  private syncTicker(): void {
    if (this.running() && this.intervalId === null) {
      this.intervalId = setInterval(() => this.now.set(Date.now()), 100);
    } else if (!this.running()) {
      this.stopTicker();
    }
  }

  private stopTicker(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
