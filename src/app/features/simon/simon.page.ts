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
import { Router, RouterLink } from '@angular/router';
import { CompetitionFeed } from '../../core/data/competition-feed';
import { ScoresService } from '../../core/data/scores.service';
import { describeError } from '../../core/firebase/errors';
import { Group, SIMON_DIFFICULTY_LABELS, Test } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { JudgeStore } from '../judge/judge.store';
import { SimonAudio } from './simon-audio';
import { evaluatePress, flashDurationMs, flashGapMs, nextPad, stepsInRound } from './simon-game';
import { loadSettings, normalizeSettings } from './simon-settings';

type Phase = 'setup' | 'countdown' | 'showing' | 'input' | 'roundOk' | 'failed' | 'finished' | 'saved';

interface Pad {
  readonly index: number;
  readonly name: string;
}

/**
 * Simón dice para proyector u ordenador (solo jueces). Se abre desde
 * "Registrar tiempo" con el grupo, la prueba y los ajustes (dificultad, rondas,
 * penalización) ya elegidos, y arranca directamente. El grupo repite la
 * secuencia; el reloj corre hasta superar todas las rondas y cada fallo suma la
 * penalización de la prueba y repite la ronda. El resultado se guarda como
 * cualquier otro tiempo (transacción con auditoría y ranking).
 *
 * El tiempo se mide con performance.now(): no depende de los intervalos, que
 * solo refrescan la pantalla.
 */
@Component({
  selector: 'app-simon-page',
  imports: [RouterLink, Icon, DurationPipe],
  providers: [CompetitionFeed, JudgeStore],
  templateUrl: './simon.page.html',
  styleUrl: './simon.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimonPage {
  protected readonly store = inject(JudgeStore);
  private readonly scores = inject(ScoresService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Query params, enlazados por withComponentInputBinding. */
  readonly prueba = input<string>();
  readonly grupo = input<string>();
  readonly dificultad = input<string>();
  readonly rondas = input<string>();
  readonly penalizacion = input<string>();

  protected readonly pads: readonly Pad[] = [
    { index: 0, name: 'Verde' },
    { index: 1, name: 'Rojo' },
    { index: 2, name: 'Amarillo' },
    { index: 3, name: 'Azul' },
  ];

  protected readonly test = computed<Test | null>(
    () =>
      this.store.feed.activeTests().find((t) => t.id === this.prueba() && t.kind === 'simon') ?? null,
  );
  protected readonly group = computed<Group | null>(
    () => this.store.activeGroups().find((g) => g.id === this.grupo()) ?? null,
  );
  /** Ajustes de la partida: de la URL o, si faltan, los últimos usados en este dispositivo. */
  protected readonly settings = computed(() => {
    if (!this.dificultad() && !this.rondas() && !this.penalizacion()) return loadSettings();
    return normalizeSettings({
      difficulty: this.dificultad(),
      rounds: this.rondas(),
      penaltySeconds: this.penalizacion(),
    });
  });
  protected readonly config = this.settings;
  protected readonly difficulty = computed(() => this.settings().difficulty);
  protected readonly difficultyLabels = SIMON_DIFFICULTY_LABELS;

  // ---------- Estado de la partida ----------
  protected readonly phase = signal<Phase>('setup');
  protected readonly countdown = signal(3);
  protected readonly round = signal(1);
  protected readonly fails = signal(0);
  protected readonly lit = signal<number | null>(null);
  protected readonly muted = signal(false);
  protected readonly saving = signal(false);
  private readonly now = signal(0);
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private sequence: number[] = [];
  private inputIndex = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;
  private readonly audio = new SimonAudio();

  protected readonly playing = computed(() => !['setup', 'finished', 'saved'].includes(this.phase()));
  protected readonly elapsedMs = computed(() => {
    this.now();
    if (this.startedAt === null) return 0;
    return Math.max(0, (this.endedAt ?? performance.now()) - this.startedAt);
  });
  protected readonly penaltyMs = computed(() => this.fails() * this.config().penaltySeconds * 1000);
  protected readonly totalMs = computed(() => this.elapsedMs() + this.penaltyMs());
  protected readonly status = computed(() => {
    switch (this.phase()) {
      case 'countdown':
        return 'Preparados…';
      case 'showing':
        return 'Observad la secuencia';
      case 'input':
        return '¡Vuestro turno!';
      case 'roundOk':
        return '¡Bien!';
      case 'failed':
        return `¡Fallo! +${this.config().penaltySeconds} s · repetimos la ronda`;
      case 'finished':
      case 'saved':
        return '¡Completado!';
      default:
        return '';
    }
  });

  private autoStarted = false;

  constructor() {
    // Se llega desde "Registrar tiempo" pulsando "Jugar": la partida empieza sola.
    effect(() => {
      const ready = !this.store.loading() && !!this.test() && !!this.group();
      untracked(() => {
        if (ready && !this.autoStarted && this.phase() === 'setup') {
          this.autoStarted = true;
          void this.start();
        }
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.clearTimers();
      this.audio.close();
    });
  }

  // ---------- Inicio ----------

  protected start(): void {
    if (!this.test() || !this.group()) return;
    this.audio.unlock();
    this.resetGame();
    this.phase.set('countdown');
    this.countdown.set(3);
    for (let i = 1; i <= 3; i++) {
      this.later(i * 1000, () => {
        if (i < 3) this.countdown.set(3 - i);
        else this.begin();
      });
    }
  }

  // ---------- Partida ----------

  protected press(pad: number): void {
    if (this.phase() !== 'input') return;
    this.flash(pad, 220);
    const { rounds } = this.config();
    const difficulty = this.difficulty();
    const outcome = evaluatePress(
      this.sequence,
      stepsInRound(this.round(), difficulty),
      this.round() >= rounds,
      this.inputIndex,
      pad,
    );
    switch (outcome) {
      case 'correct':
        this.inputIndex += 1;
        break;
      case 'roundComplete':
        this.phase.set('roundOk');
        this.later(700, () => {
          this.round.update((r) => r + 1);
          this.sequence.push(nextPad(this.sequence));
          this.playSequence();
        });
        break;
      case 'gameComplete':
        this.endedAt = performance.now();
        this.stopTicker();
        this.phase.set('finished');
        this.later(250, () => this.audio.success());
        break;
      case 'wrong':
        this.fails.update((f) => f + 1);
        this.phase.set('failed');
        this.audio.error();
        this.later(1600, () => this.playSequence());
        break;
    }
  }

  protected toggleMute(): void {
    this.muted.update((m) => !m);
    this.audio.muted = this.muted();
  }

  protected async abandon(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Abandonar partida',
      message: 'Se perderá el tiempo de esta partida.',
      confirmLabel: 'Abandonar',
      danger: true,
    });
    if (ok) this.toSetup();
  }

  // ---------- Resultado ----------

  protected async save(): Promise<void> {
    const test = this.test();
    const group = this.group();
    if (!test || !group || this.phase() !== 'finished' || this.saving()) return;
    this.saving.set(true);
    try {
      await this.scores.save(
        { groupId: group.id, groupName: group.name, testId: test.id, testName: test.name },
        { timeMs: Math.max(1, Math.round(this.elapsedMs())), penaltyMs: this.penaltyMs() },
        this.store.feed.activeTestIds(),
      );
      this.phase.set('saved');
      this.toast.success(`Guardado: ${group.name} · ${test.name}`);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido guardar el resultado.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async retry(): Promise<void> {
    if (this.phase() === 'finished') {
      const ok = await this.confirm.ask({
        title: 'Repetir sin guardar',
        message: 'El resultado de esta partida no se ha guardado y se perderá.',
        confirmLabel: 'Repetir',
      });
      if (!ok) return;
    }
    this.toSetup();
    this.start();
  }

  /** Vuelve a "Registrar tiempo" con la prueba elegida, para pasar al siguiente grupo. */
  protected async nextGroup(): Promise<void> {
    if (!(await this.confirmLeave())) return;
    await this.router.navigate(['/juez/puntuar'], { queryParams: { prueba: this.prueba() } });
  }

  /** Vuelve al formulario de este grupo y esta prueba en "Registrar tiempo". */
  protected async exit(): Promise<void> {
    if (!(await this.confirmLeave())) return;
    await this.router.navigate(['/juez/puntuar'], {
      queryParams: { grupo: this.grupo(), prueba: this.prueba() },
    });
  }

  private async confirmLeave(): Promise<boolean> {
    if (this.playing()) {
      return this.confirm.ask({
        title: 'Salir del Simón dice',
        message: 'Se perderá la partida en curso.',
        confirmLabel: 'Salir',
        danger: true,
      });
    }
    if (this.phase() === 'finished') {
      return this.confirm.ask({
        title: 'Salir sin guardar',
        message: 'El resultado de esta partida no se ha guardado y se perderá.',
        confirmLabel: 'Salir',
      });
    }
    return true;
  }

  // ---------- Internos ----------

  private begin(): void {
    this.startedAt = performance.now();
    this.endedAt = null;
    this.ticker = setInterval(() => this.now.set(performance.now()), 100);
    this.sequence = [];
    const firstSteps = stepsInRound(1, this.difficulty());
    for (let i = 0; i < firstSteps; i++) this.sequence.push(nextPad(this.sequence));
    this.round.set(1);
    this.later(300, () => this.playSequence());
  }

  private playSequence(): void {
    this.phase.set('showing');
    this.inputIndex = 0;
    const round = this.round();
    const difficulty = this.difficulty();
    const steps = stepsInRound(round, difficulty);
    const flash = flashDurationMs(round, difficulty);
    const step = flash + flashGapMs(round, difficulty);
    this.sequence.slice(0, steps).forEach((pad, i) => this.later(i * step, () => this.flash(pad, flash)));
    this.later(steps * step, () => this.phase.set('input'));
  }

  private flash(pad: number, durationMs: number): void {
    this.lit.set(pad);
    this.audio.pad(pad, durationMs);
    this.later(durationMs, () => {
      if (this.lit() === pad) this.lit.set(null);
    });
  }

  private toSetup(): void {
    this.resetGame();
    this.phase.set('setup');
  }

  private resetGame(): void {
    this.clearTimers();
    this.startedAt = null;
    this.endedAt = null;
    this.sequence = [];
    this.inputIndex = 0;
    this.round.set(1);
    this.fails.set(0);
    this.lit.set(null);
    this.now.set(0);
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.now.set(performance.now());
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.stopTicker();
  }
}
