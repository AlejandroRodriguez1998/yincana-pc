import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompetitionFeed } from '../../core/data/competition-feed';
import { RankingEntry } from '../../core/models';
import { Icon } from '../../shared/components/icon/icon';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { RevealToggle } from '../judge/reveal-toggle/reveal-toggle';

export type FinalResultsMode = 'fullscreen' | 'embedded';

/**
 * Fases del podio:
 * - hidden: ranking oculto a los grupos → podio "en misterio" y tabla oculta.
 * - revealing: animación en curso (3º → 2º → suspense → 1º → tabla).
 * - done: todo visible.
 */
type RevealPhase = 'hidden' | 'revealing' | 'done';

/** Tiempos de la secuencia de revelado, en ms. */
const REVEAL_TIMING = {
  start: 500,
  betweenPlaces: 2200,
  suspense: 2400,
  table: 2600,
  countUp: 1400,
} as const;

/** Piezas de confeti (posición, retardo y color precalculados). */
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 12) * 0.09,
  duration: 2.2 + ((i * 7) % 10) / 10,
  rotate: (i * 53) % 360,
  color: ['#f2c14e', '#4d8dff', '#2fcf8f', '#ff6b6b', '#ffffff', '#c9d3df'][i % 6],
}));

/**
 * Podio + tabla completa grupo × prueba, con columnas generadas desde Firestore
 * y actualización en tiempo real.
 *
 * - `fullscreen` (/resultados): pantalla final para proyector o TV, sin menú.
 * - `embedded` (/ranking): el mismo ranking dentro del panel del juez.
 *
 * No provee su propio CompetitionFeed: usa el del contenedor (JudgeShell o
 * FinalResultsPage), así no se duplican listeners.
 */
@Component({
  selector: 'app-final-results',
  imports: [RouterLink, Icon, DurationPipe, RevealToggle],
  templateUrl: './final-results.html',
  styleUrl: './final-results.scss',
  host: { '[class.embedded]': "mode() === 'embedded'" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalResults {
  protected readonly feed = inject(CompetitionFeed);
  /** Enlazado también desde `data.mode` de la ruta. */
  readonly mode = input<FinalResultsMode>('fullscreen');

  protected readonly revealed = this.feed.rankingRevealed;
  protected readonly phase = signal<RevealPhase>('hidden');
  /** Cuántos puestos del podio se han desvelado, empezando por el último (3º). */
  protected readonly shownPlaces = signal(0);
  /** Suspense antes de desvelar el primer puesto. */
  protected readonly suspense = signal(false);
  /** Tiempos animados (contador) por índice de podio mientras se revelan. */
  protected readonly counters = signal<Readonly<Record<number, number>>>({});
  protected readonly confetti = CONFETTI;
  protected readonly confettiOn = signal(false);
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private frames: number[] = [];
  private initialized = false;

  protected readonly tests = this.feed.activeTests;
  protected readonly ranking = this.feed.ranking;
  protected readonly isFullscreen = signal(!!document.fullscreenElement);
  protected readonly fullscreenSupported = !!document.documentElement.requestFullscreen;

  /** Hay resultados cuando al menos un grupo tiene alguna prueba registrada. */
  protected readonly started = computed(() => this.ranking().some((e) => e.completed > 0));
  /** La competición ha terminado cuando todos los grupos activos han hecho todas las pruebas activas. */
  protected readonly finished = computed(() => {
    const total = this.tests().length;
    return total > 0 && this.ranking().length > 0 && this.ranking().every((e) => e.completed === total);
  });
  protected readonly winners = computed(() =>
    this.started() ? this.ranking().filter((e) => e.position === 1) : [],
  );
  /** Texto sobre el primer puesto del podio. */
  protected readonly leaderLabel = computed(() => {
    const tied = this.winners().length > 1;
    if (this.finished()) return tied ? 'Empate en primera posición' : 'Equipo ganador';
    return tied ? 'Empatados en cabeza' : 'Va en cabeza';
  });
  protected readonly podium = computed<readonly RankingEntry[]>(() =>
    this.started() ? this.ranking().filter((e) => e.position <= 3 && e.completed > 0).slice(0, 3) : [],
  );
  /** Mejor tiempo (el menor) de cada prueba, para destacarlo en la tabla. */
  protected readonly bestByTest = computed(() => {
    const best = new Map<string, number>();
    for (const entry of this.ranking()) {
      for (const [testId, result] of Object.entries(entry.results)) {
        best.set(testId, Math.min(best.get(testId) ?? Infinity, result.totalMs));
      }
    }
    return best;
  });

  /**
   * Hasta que el podio está totalmente desvelado, la tabla no muestra tiempo
   * total ni posición, y las filas van en orden alfabético (el orden del
   * ranking también sería un spoiler).
   */
  protected readonly concealed = computed(() => this.phase() !== 'done');
  protected readonly tableRows = computed<readonly RankingEntry[]>(() =>
    this.concealed()
      ? [...this.ranking()].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
      : this.ranking(),
  );

  constructor() {
    const onChange = () => this.isFullscreen.set(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', onChange);
      this.cancelReveal();
    });

    // Al abrir la página se muestra el estado actual sin animación; si mientras
    // está abierta un juez revela el ranking, se reproduce la secuencia.
    effect(() => {
      const revealed = this.revealed();
      const loading = this.feed.loading();
      untracked(() => {
        if (loading) return;
        if (!this.initialized) {
          this.initialized = true;
          this.setFinal(revealed);
          return;
        }
        if (revealed && this.phase() === 'hidden') {
          this.playReveal();
        } else if (!revealed) {
          this.setFinal(false);
        }
      });
    });
  }

  /** ¿Está desvelado el puesto del podio con índice `i` (0 = 1º)? */
  protected placeShown(index: number): boolean {
    if (this.phase() === 'done') return true;
    return index >= this.podium().length - this.shownPlaces();
  }

  protected displayMs(index: number, entry: RankingEntry): number {
    return this.counters()[index] ?? entry.totalMs;
  }

  private playReveal(): void {
    this.cancelReveal();
    const count = this.podium().length;
    if (this.reducedMotion || count === 0) {
      this.setFinal(true);
      return;
    }
    this.phase.set('revealing');
    this.shownPlaces.set(0);

    let at: number = REVEAL_TIMING.start;
    // De abajo arriba: 3º, 2º y, tras el suspense, 1º.
    for (let step = 1; step <= count; step++) {
      const index = count - step;
      const isWinner = index === 0;
      if (isWinner && count > 1) {
        this.schedule(at, () => this.suspense.set(true));
        at += REVEAL_TIMING.suspense;
      }
      this.schedule(at, () => {
        this.suspense.set(false);
        this.shownPlaces.set(step);
        this.countUp(index);
        if (isWinner) {
          this.confettiOn.set(true);
          this.schedule(4500, () => this.confettiOn.set(false));
        }
      });
      at += isWinner ? REVEAL_TIMING.table : REVEAL_TIMING.betweenPlaces;
    }
    this.schedule(at, () => this.phase.set('done'));
  }

  /** Anima el tiempo total del puesto desde 0 hasta su valor real. */
  private countUp(index: number): void {
    const target = this.podium()[index]?.totalMs ?? 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / REVEAL_TIMING.countUp);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.counters.update((c) => ({ ...c, [index]: Math.round(target * eased) }));
      if (progress < 1) {
        this.frames.push(requestAnimationFrame(tick));
      } else {
        this.counters.update((c) => {
          const next = { ...c };
          delete next[index];
          return next;
        });
      }
    };
    this.frames.push(requestAnimationFrame(tick));
  }

  private setFinal(revealed: boolean): void {
    this.cancelReveal();
    this.phase.set(revealed ? 'done' : 'hidden');
    this.shownPlaces.set(revealed ? 3 : 0);
  }

  private schedule(delay: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, delay));
  }

  private cancelReveal(): void {
    this.timers.forEach(clearTimeout);
    this.frames.forEach(cancelAnimationFrame);
    this.timers = [];
    this.frames = [];
    this.suspense.set(false);
    this.confettiOn.set(false);
    this.counters.set({});
  }

  protected async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // El navegador puede denegarlo; la pantalla sigue funcionando igual.
    }
  }

  protected medal(position: number): string {
    return position === 1 ? 'gold' : position === 2 ? 'silver' : position === 3 ? 'bronze' : '';
  }
}
