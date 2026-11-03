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
import { RouterLink } from '@angular/router';
import { Unsubscribe, doc, onSnapshot } from 'firebase/firestore';
import { DiskService, toDiskInfo, toDiskRun, toDiskSecret } from '../../../core/data/disk.service';
import { COLLECTIONS } from '../../../core/data/paths';
import { describeError } from '../../../core/firebase/errors';
import { FIRESTORE } from '../../../core/firebase/firebase.providers';
import { DiskInfo, DiskRun, DiskSecret, MAX_TIME_MS, diskPhase, diskRunId } from '../../../core/models';
import { Icon } from '../../../shared/components/icon/icon';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';

export interface DiskRunResult {
  readonly timeMs: number;
  readonly penaltyMs: number;
}

/**
 * Partida de "Recupera el archivo" de un grupo, en directo, dentro de
 * Registrar tiempo: reloj grande, por dónde va y, al terminar, el resultado
 * calculado (tiempo de la partida + fallos × penalización) listo para guardar.
 */
@Component({
  selector: 'app-disk-run-panel',
  imports: [RouterLink, Icon, DurationPipe],
  template: `
    @if (error(); as e) {
      <p class="form-error">{{ e }}</p>
    } @else if (!loaded()) {
      <div class="skeleton" style="height: 150px"></div>
    } @else if (!info()) {
      <p class="muted">Este grupo aún no tiene disco.</p>
      <a class="btn btn-outline btn-block" [routerLink]="['/juez/disco', testId()]">
        <app-icon name="disk" [size]="18" /> Generar discos en el panel de la prueba
      </a>
    } @else {
      @let i = info()!;
      <div class="clock-box" [class.done]="phase() === 'done'">
        <span class="status small">{{ status() }}</span>
        <strong class="big mono">{{ (phase() === 'done' ? total() : elapsed()) | duration }}</strong>
        @if (run(); as r) {
          <span class="small">
            @if (r.wrong > 0) {
              {{ r.wrong }} {{ r.wrong === 1 ? 'fallo' : 'fallos' }} · +{{ penaltyMs() | duration: false }}
              @if (phase() === 'done') {
                <span class="faint">(partida {{ elapsed() | duration }})</span>
              }
            } @else {
              Sin fallos
            }
          </span>
        }
      </div>

      @if (run(); as r) {
        <div class="sectors" aria-hidden="true">
          @for (n of range(i.count); track n) {
            <span [class.read]="n < r.step" [class.found]="n === r.step && r.found > r.step"></span>
          }
        </div>
      }

      @if (result(); as res) {
        <button type="button" class="btn btn-primary btn-lg btn-block" (click)="record.emit(res)" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner" aria-hidden="true"></span> Guardando…
          } @else {
            <app-icon name="check" /> Registrar {{ res.timeMs + res.penaltyMs | duration }}
          }
        </button>
      } @else {
        <p class="hint">
          @if (!run()) {
            El tiempo empieza cuando el grupo pulsa "Montar disco" en su móvil.
          } @else {
            Cuando el grupo entregue el archivo correcto podrás registrar su tiempo aquí.
          }
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .clock-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 18px 12px;
      border-radius: var(--radius-lg);
      background: var(--surface-2);
      text-align: center;

      &.done {
        background: var(--accent-soft);
      }
    }
    .status {
      color: var(--text-muted);
      font-weight: 600;
    }
    .big {
      font-size: clamp(2.4rem, 12vw, 3.4rem);
      font-weight: 800;
      line-height: 1.1;
    }
    .sectors {
      display: flex;
      gap: 4px;

      span {
        flex: 1;
        height: 10px;
        border-radius: 3px;
        background: var(--surface-3);

        &.found {
          background: var(--warning);
        }
        &.read {
          background: var(--accent);
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiskRunPanel {
  private readonly db = inject(FIRESTORE);
  private readonly disk = inject(DiskService);

  readonly testId = input.required<string>();
  readonly groupId = input.required<string>();
  readonly saving = input(false);
  readonly record = output<DiskRunResult>();

  protected readonly info = signal<DiskInfo | null>(null);
  protected readonly run = signal<DiskRun | null>(null);
  protected readonly secret = signal<DiskSecret | null>(null);
  private readonly pending = signal(3);
  protected readonly loaded = computed(() => this.pending() === 0);
  protected readonly error = signal<string | null>(null);
  private readonly now = signal(Date.now());

  protected readonly phase = computed(() => {
    const run = this.run();
    const info = this.info();
    return run && info ? diskPhase(run, info.count) : null;
  });

  protected readonly status = computed(() => {
    const run = this.run();
    const info = this.info();
    if (!run || !info) return 'Sin empezar';
    const label = this.secret()?.labels[run.step] ?? '';
    switch (this.phase()) {
      case 'locate':
        return `Buscando el sector ${label} · ${run.step}/${info.count}`;
      case 'question':
        return `Respondiendo en ${label} · ${run.step}/${info.count}`;
      case 'rebuild':
        return 'Reconstruyendo el archivo';
      default:
        return 'Terminado · tiempo total';
    }
  });

  protected readonly elapsed = computed(() => {
    const run = this.run();
    if (!run?.startedAt) return 0;
    const end = run.finishedAt?.getTime() ?? this.now();
    return Math.max(0, end - run.startedAt.getTime());
  });
  protected readonly penaltyMs = computed(() => (this.run()?.wrong ?? 0) * (this.info()?.penaltyMs ?? 0));
  protected readonly total = computed(() => this.elapsed() + this.penaltyMs());

  protected readonly result = computed<DiskRunResult | null>(() => {
    const run = this.run();
    if (this.phase() !== 'done' || !run?.startedAt || !run.finishedAt) return null;
    return {
      timeMs: Math.min(MAX_TIME_MS, Math.max(1, run.finishedAt.getTime() - run.startedAt.getTime())),
      penaltyMs: Math.min(MAX_TIME_MS, this.penaltyMs()),
    };
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    effect((onCleanup) => {
      const testId = this.testId();
      const groupId = this.groupId();
      const subs: Unsubscribe[] = [];
      untracked(() => {
        this.info.set(null);
        this.run.set(null);
        this.secret.set(null);
        this.error.set(null);
        this.pending.set(3);
        const done = () => this.pending.update((n) => Math.max(0, n - 1));
        const fail = (err: unknown) => {
          this.error.set(describeError(err, 'No se ha podido cargar la partida.'));
          done();
        };
        let first = [true, true, true];
        const once = (i: number) => {
          if (first[i]) {
            first = first.map((v, j) => (j === i ? false : v));
            done();
          }
        };
        const runId = diskRunId(testId, groupId);
        subs.push(
          onSnapshot(
            this.disk.infoRef(testId, groupId),
            (s) => {
              this.info.set(s.exists() ? toDiskInfo(s) : null);
              once(0);
            },
            fail,
          ),
          onSnapshot(
            this.disk.runRef(testId, groupId),
            (s) => {
              this.run.set(s.exists() ? toDiskRun(s) : null);
              once(1);
            },
            fail,
          ),
          onSnapshot(
            doc(this.db, COLLECTIONS.diskSecrets, runId),
            (s) => {
              this.secret.set(s.exists() ? toDiskSecret(s) : null);
              once(2);
            },
            fail,
          ),
        );
      });
      onCleanup(() => subs.forEach((u) => u()));
    });
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
}
