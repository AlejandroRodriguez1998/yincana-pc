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
import { Unsubscribe, onSnapshot } from 'firebase/firestore';
import { DiskService, toDiskInfo, toDiskRun } from '../../../core/data/disk.service';
import { describeError } from '../../../core/firebase/errors';
import {
  DiskInfo,
  DiskReveal,
  DiskRun,
  DiskStep,
  Test,
  diskPhase,
  diskRunId,
  normalizeDiskCode,
} from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { QrScanner } from '../../../shared/components/qr-scanner/qr-scanner';
import { eventValue } from '../../../shared/dom';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { GroupStore } from '../group.store';

/** Bloque del disco ya leído, para el mapa. */
interface Block {
  readonly label: string;
  readonly fragment: string;
  readonly next: string | null;
}

/**
 * Partida de "Recupera el archivo" desde el móvil del grupo:
 * montar disco → (buscar sector → escanear → responder) × N → reconstruir archivo.
 * Cada avance lo valida Firestore (ver firestore.rules, sección disk).
 */
@Component({
  selector: 'app-group-disk-page',
  imports: [RouterLink, Icon, QrScanner, EmptyState, ErrorState, DurationPipe],
  templateUrl: './group-disk.page.html',
  styleUrl: './group-disk.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDiskPage {
  protected readonly store = inject(GroupStore);
  private readonly disk = inject(DiskService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Parámetro de ruta. */
  readonly testId = input.required<string>();
  /** Código de sector si se llega escaneando el QR con la cámara del móvil (?s=…). */
  readonly s = input<string>();

  protected readonly value = eventValue;

  protected readonly test = computed<Test | null>(() => this.store.feed.testsById().get(this.testId()) ?? null);
  private readonly runId = computed(() => diskRunId(this.testId(), this.store.groupId));

  protected readonly info = signal<DiskInfo | null>(null);
  protected readonly infoLoaded = signal(false);
  /** Partida confirmada por el servidor (se ignoran los cambios locales pendientes). */
  protected readonly run = signal<DiskRun | null>(null);
  protected readonly runLoaded = signal(false);
  protected readonly loadError = signal<string | null>(null);

  private readonly reveals = signal<ReadonlyMap<number, DiskReveal>>(new Map());
  private readonly steps = signal<ReadonlyMap<number, DiskStep>>(new Map());

  protected readonly busy = signal(false);
  protected readonly scanning = signal(false);
  protected readonly codeText = signal('');
  protected readonly codeError = signal<string | null>(null);
  protected readonly fileText = signal('');
  /** Opciones falladas en la pregunta actual (clave: paso). */
  protected readonly wrongOptions = signal<{ step: number; options: ReadonlySet<number> }>({
    step: -1,
    options: new Set(),
  });
  /** Último fragmento leído, para destacarlo. */
  protected readonly lastRead = signal<Block | null>(null);
  protected readonly now = signal(Date.now());
  private readonly pendingCode = signal<string | null>(null);

  protected readonly phase = computed(() => {
    const run = this.run();
    const info = this.info();
    return run && info ? diskPhase(run, info.count) : null;
  });

  /** Sector que hay que buscar ahora (o en el que se está respondiendo). */
  protected readonly target = computed(() => {
    const run = this.run();
    return run ? (this.reveals().get(run.step)?.nextLabel ?? null) : null;
  });

  protected readonly question = computed(() => {
    const run = this.run();
    return run && this.phase() === 'question' ? (this.steps().get(run.step) ?? null) : null;
  });

  /** Entrada del directorio: el primer sector del archivo. */
  protected readonly startLabel = computed(() => this.reveals().get(0)?.nextLabel ?? null);

  /** Bloques leídos, en orden físico (por etiqueta): para reconstruir hay que seguir los punteros. */
  protected readonly blocks = computed<readonly Block[]>(() => {
    const run = this.run();
    if (!run) return [];
    const reveals = this.reveals();
    const result: Block[] = [];
    for (let i = 0; i < run.step; i++) {
      const at = reveals.get(i);
      const read = reveals.get(i + 1);
      if (at?.nextLabel && read?.fragment) {
        result.push({ label: at.nextLabel, fragment: read.fragment, next: read.nextLabel });
      }
    }
    return result.sort((a, b) => parseInt(a.label, 16) - parseInt(b.label, 16));
  });

  protected readonly elapsed = computed(() => {
    const run = this.run();
    if (!run?.startedAt) return 0;
    const end = run.finishedAt?.getTime() ?? this.now();
    return Math.max(0, end - run.startedAt.getTime());
  });
  protected readonly penaltyMs = computed(() => (this.run()?.wrong ?? 0) * (this.info()?.penaltyMs ?? 0));

  protected readonly loading = computed(() => this.store.loading() || !this.infoLoaded() || !this.runLoaded());

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    // Listeners del disco y de la partida del grupo.
    effect((onCleanup) => {
      const testId = this.testId();
      const groupId = this.store.groupId;
      const subs: Unsubscribe[] = [];
      untracked(() => {
        this.reset();
        if (!groupId) return;
        subs.push(
          onSnapshot(
            this.disk.infoRef(testId, groupId),
            (snap) => {
              this.info.set(snap.exists() ? toDiskInfo(snap) : null);
              this.infoLoaded.set(true);
            },
            (err) => this.fail(err),
          ),
          onSnapshot(
            this.disk.runRef(testId, groupId),
            { includeMetadataChanges: true },
            (snap) => {
              // Solo el estado confirmado por el servidor: un avance local pendiente
              // podría ser rechazado por las reglas.
              if (snap.metadata.hasPendingWrites) return;
              this.run.set(snap.exists() ? toDiskRun(snap) : null);
              this.runLoaded.set(true);
            },
            (err) => this.fail(err),
          ),
        );
      });
      onCleanup(() => subs.forEach((u) => u()));
    });

    // Carga lo desbloqueado: punteros/fragmentos leídos y la pregunta actual.
    effect(() => {
      const run = this.run();
      const phase = this.phase();
      if (!run) return;
      untracked(() => {
        for (let i = 0; i <= run.step; i++) void this.loadReveal(run.id, i);
        if (phase === 'question') void this.loadStep(run.id, run.step);
      });
    });

    // Código llegado por URL (QR escaneado con la cámara del sistema).
    effect(() => {
      const code = this.s();
      if (code) {
        untracked(() => {
          this.pendingCode.set(normalizeDiskCode(code));
          void this.router.navigate([], { queryParams: { s: null }, queryParamsHandling: 'merge', replaceUrl: true });
        });
      }
    });
    effect(() => {
      const code = this.pendingCode();
      if (code && this.phase() === 'locate' && !this.busy()) {
        untracked(() => {
          this.pendingCode.set(null);
          void this.submitCode(code);
        });
      }
    });
  }

  private reset(): void {
    this.info.set(null);
    this.run.set(null);
    this.infoLoaded.set(false);
    this.runLoaded.set(false);
    this.reveals.set(new Map());
    this.steps.set(new Map());
  }

  private fail(err: unknown): void {
    this.loadError.set(describeError(err, 'No se ha podido cargar la prueba.'));
    this.infoLoaded.set(true);
    this.runLoaded.set(true);
  }

  private async loadReveal(runId: string, index: number): Promise<void> {
    if (this.reveals().has(index)) return;
    try {
      const reveal = await this.disk.getReveal(runId, index);
      this.reveals.update((m) => new Map(m).set(index, reveal));
    } catch (err) {
      this.loadError.set(describeError(err, 'No se ha podido leer el sector.'));
    }
  }

  private async loadStep(runId: string, index: number): Promise<void> {
    if (this.steps().has(index)) return;
    try {
      const step = await this.disk.getStep(runId, index);
      this.steps.update((m) => new Map(m).set(index, step));
    } catch (err) {
      this.loadError.set(describeError(err, 'No se ha podido leer la pregunta.'));
    }
  }

  // ---------- Acciones ----------

  protected async start(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.disk.startRun(this.testId(), this.store.groupId);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido empezar.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected onScanned(text: string): void {
    this.scanning.set(false);
    void this.submitCode(text);
  }

  protected submitTyped(): void {
    void this.submitCode(this.codeText());
  }

  private async submitCode(text: string): Promise<void> {
    const run = this.run();
    if (!run || this.busy() || this.phase() !== 'locate') return;
    this.codeError.set(null);
    if (!normalizeDiskCode(text)) {
      this.codeError.set('Escribe el código de la tarjeta.');
      return;
    }
    this.busy.set(true);
    try {
      const ok = await this.disk.submitCode(run, text);
      if (ok) {
        this.codeText.set('');
        navigator.vibrate?.(40);
      } else {
        this.codeError.set(
          `Ese no es el sector ${this.target() ?? ''}. Puede ser de otro archivo o un señuelo: revisa la FAT.`,
        );
        navigator.vibrate?.([80, 60, 80]);
      }
    } catch (err) {
      this.codeError.set(describeError(err, 'No se ha podido comprobar el código.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected isWrong(index: number): boolean {
    const w = this.wrongOptions();
    return w.step === this.run()?.step && w.options.has(index);
  }

  protected async answer(option: number): Promise<void> {
    const run = this.run();
    if (!run || this.busy() || this.isWrong(option)) return;
    this.busy.set(true);
    try {
      const result = await this.disk.answer(run, option);
      if (result === 'correct') {
        const label = this.target();
        const reveal = await this.disk.getReveal(run.id, run.step + 1);
        this.reveals.update((m) => new Map(m).set(run.step + 1, reveal));
        if (label && reveal.fragment) this.lastRead.set({ label, fragment: reveal.fragment, next: reveal.nextLabel });
        navigator.vibrate?.(40);
      } else {
        const prev = this.wrongOptions();
        const options = new Set(prev.step === run.step ? prev.options : []);
        options.add(option);
        this.wrongOptions.set({ step: run.step, options });
        this.toast.error(`Error de lectura: +${Math.round((this.info()?.penaltyMs ?? 0) / 1000)} s. Prueba otra respuesta.`);
        navigator.vibrate?.([80, 60, 80]);
      }
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido enviar la respuesta.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async submitFile(): Promise<void> {
    const run = this.run();
    if (!run || this.busy()) return;
    if (!this.fileText().replace(/\D/g, '')) return;
    this.busy.set(true);
    try {
      const result = await this.disk.submitFile(run, this.fileText());
      if (result === 'wrong') {
        this.toast.error(
          `Archivo corrupto: +${Math.round((this.info()?.penaltyMs ?? 0) / 1000)} s. Sigue los punteros desde el sector inicial.`,
        );
        navigator.vibrate?.([80, 60, 80]);
      }
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido enviar el archivo.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected optionLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }
}
