import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ScoreTarget, ScoresService } from '../../../core/data/scores.service';
import { describeError } from '../../../core/firebase/errors';
import { Group, MAX_TIME_MS, Score, Test, computeTotalTime } from '../../../core/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { DurationPipe, formatDuration, parseDuration } from '../../../shared/pipes/duration.pipe';
import { eventValue } from '../../../shared/dom';
import { groupBadge } from '../../../shared/group-badge';
import { JudgeStore } from '../judge.store';
import { Stopwatch } from './stopwatch';

const PIN_KEY = 'yincana.scoring.pinnedTest';

function wholeNumber(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  return value === null || Number.isInteger(value) ? null : { integer: true };
}

function positiveTime(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  return value !== null && value > 0 ? null : { required: true };
}

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function readPinned(): string | null {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

type Step = 'group' | 'test' | 'form';

/**
 * Flujo rápido de registro: grupo → prueba → cronómetro (+ penalización) → guardar.
 * El estado vive en la URL (?grupo=…&prueba=…), así el botón "atrás" del móvil
 * vuelve al paso anterior y se puede enlazar directamente a un grupo o prueba.
 */
@Component({
  selector: 'app-scoring-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, Stopwatch, EmptyState, ErrorState, DurationPipe],
  templateUrl: './scoring.page.html',
  styleUrl: './scoring.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoringPage {
  protected readonly store = inject(JudgeStore);
  private readonly scores = inject(ScoresService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Query params enlazados por withComponentInputBinding. */
  readonly grupo = input<string>();
  readonly prueba = input<string>();

  private readonly stopwatch = viewChild(Stopwatch);

  protected readonly search = signal('');
  protected readonly pinnedTestId = signal<string | null>(readPinned());
  protected readonly saving = signal(false);
  protected readonly existing = signal<Score | null>(null);
  protected readonly loadingExisting = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly editingTime = signal(false);
  protected readonly timeText = signal('');

  protected readonly group = computed<Group | null>(() => {
    const id = this.grupo();
    const group = id ? this.store.groupsById().get(id) : undefined;
    return group?.active ? group : null;
  });
  protected readonly test = computed<Test | null>(() => {
    const id = this.prueba();
    const test = id ? this.store.feed.testsById().get(id) : undefined;
    return test?.active ? test : null;
  });
  protected readonly step = computed<Step>(() =>
    !this.group() ? 'group' : !this.test() ? 'test' : 'form',
  );
  /** Clave estable de la combinación: solo cambia al elegir otro grupo o prueba. */
  protected readonly comboKey = computed(() => {
    if (this.store.loading()) return null;
    const group = this.group();
    const test = this.test();
    return group && test ? `${group.id}__${test.id}` : null;
  });

  protected readonly filteredGroups = computed(() => {
    const term = normalizeText(this.search());
    const groups = this.store.activeGroups();
    return term ? groups.filter((g) => normalizeText(g.name).includes(term)) : groups;
  });

  protected readonly form = this.fb.group({
    timeMs: this.fb.control<number | null>(null, [positiveTime, Validators.max(MAX_TIME_MS)]),
    /** Penalización en segundos enteros (se guarda en ms). */
    penaltySeconds: this.fb.control<number | null>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(MAX_TIME_MS / 1000),
      wholeNumber,
    ]),
  });
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly timeValue = computed(() => this.formValue().timeMs ?? null);
  protected readonly penaltyMs = computed(() => {
    const seconds = this.formValue().penaltySeconds;
    return typeof seconds === 'number' && seconds > 0 ? Math.round(seconds * 1000) : 0;
  });
  protected readonly totalPreview = computed(() => {
    const time = this.timeValue();
    return time === null ? null : computeTotalTime(time, this.penaltyMs());
  });

  protected readonly value = eventValue;
  protected readonly badge = groupBadge;
  private loadSeq = 0;

  constructor() {
    // Prepara el formulario solo cuando cambia la combinación grupo/prueba
    // (no cuando llegan actualizaciones en directo de otros grupos).
    effect(() => {
      const key = this.comboKey();
      untracked(() => this.prepareForm(key));
    });
  }

  // ---------- Navegación entre pasos ----------

  protected selectGroup(group: Group): void {
    const pinned = this.pinnedTestId();
    const test = this.prueba() ?? (pinned && this.store.feed.testsById().get(pinned)?.active ? pinned : null);
    this.search.set('');
    void this.router.navigate([], { queryParams: { grupo: group.id, prueba: test }, queryParamsHandling: 'merge' });
  }

  protected selectTest(test: Test): void {
    void this.router.navigate([], { queryParams: { prueba: test.id }, queryParamsHandling: 'merge' });
  }

  protected changeGroup(): void {
    void this.router.navigate([], { queryParams: { grupo: null }, queryParamsHandling: 'merge' });
  }

  protected changeTest(): void {
    void this.router.navigate([], { queryParams: { prueba: null }, queryParamsHandling: 'merge' });
  }

  protected togglePin(test: Test): void {
    const next = this.pinnedTestId() === test.id ? null : test.id;
    this.pinnedTestId.set(next);
    try {
      if (next) localStorage.setItem(PIN_KEY, next);
      else localStorage.removeItem(PIN_KEY);
    } catch {
      // Sin almacenamiento, la prueba fijada solo dura esta sesión.
    }
    this.toast.info(next ? `Prueba fijada: ${test.name}. Tras guardar pasarás al siguiente grupo.` : 'Prueba liberada.');
  }

  // ---------- Formulario ----------

  protected addPenalty(seconds: number): void {
    const ctrl = this.form.controls.penaltySeconds;
    ctrl.setValue(Math.max(0, Math.round((ctrl.value ?? 0) + seconds)));
    ctrl.markAsTouched();
  }

  protected resetPenalty(): void {
    this.form.controls.penaltySeconds.setValue(0);
  }

  protected onCaptured(ms: number | null): void {
    this.form.controls.timeMs.setValue(ms);
  }

  protected startTimeEdit(): void {
    this.timeText.set(this.timeValue() === null ? '' : formatDuration(this.timeValue()));
    this.editingTime.set(true);
  }

  protected commitTimeEdit(): void {
    const text = this.timeText().trim();
    if (!text) {
      this.form.controls.timeMs.setValue(null);
      this.editingTime.set(false);
      return;
    }
    const ms = parseDuration(text);
    if (ms === null) {
      this.toast.error('Formato de tiempo no válido. Usa m:ss (p. ej. 3:25.4).');
      return;
    }
    this.form.controls.timeMs.setValue(ms);
    this.form.controls.timeMs.markAsTouched();
    this.editingTime.set(false);
  }

  protected clearTime(): void {
    this.form.controls.timeMs.setValue(null);
    this.editingTime.set(false);
  }

  protected async save(): Promise<void> {
    const group = this.group();
    const test = this.test();
    if (!group || !test || this.saving()) return;

    const captured = this.stopwatch()?.captureIfRunning();
    if (captured !== null && captured !== undefined) this.form.controls.timeMs.setValue(captured);
    if (this.editingTime()) this.commitTimeEdit();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const timeMs = this.timeValue();
    if (timeMs === null) return;
    const penaltyMs = this.penaltyMs();

    this.saving.set(true);
    try {
      const result = await this.scores.save(
        this.target(group, test),
        { timeMs, penaltyMs },
        this.store.feed.activeTestIds(),
      );
      const total = formatDuration(computeTotalTime(timeMs, penaltyMs));
      this.toast.success(
        result === 'unchanged'
          ? 'Sin cambios: el resultado ya era ese.'
          : `${result === 'created' ? 'Guardado' : 'Actualizado'}: ${group.name} · ${test.name} → ${total}`,
      );
      this.stopwatch()?.clear();
      this.goNext(group, test);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido guardar el resultado.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const group = this.group();
    const test = this.test();
    if (!group || !test || !this.existing()) return;
    const ok = await this.confirm.ask({
      title: 'Eliminar resultado',
      message: `Se eliminará el tiempo de ${group.name} en "${test.name}". Quedará registrado en el historial.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.saving.set(true);
    try {
      await this.scores.remove(this.target(group, test), this.store.feed.activeTestIds());
      this.toast.success('Resultado eliminado.');
      this.stopwatch()?.clear();
      this.prepareForm(this.comboKey());
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido eliminar el resultado.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected timeError(): string | null {
    const ctrl = this.form.controls.timeMs;
    if (!ctrl.touched || ctrl.valid) return null;
    return ctrl.hasError('max') ? 'El tiempo no puede superar 24 horas.' : 'Registra el tiempo con el cronómetro o a mano.';
  }

  protected penaltyError(): string | null {
    const ctrl = this.form.controls.penaltySeconds;
    if (!ctrl.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return 'Introduce la penalización (0 si no hay).';
    if (ctrl.hasError('min')) return 'No puede ser negativa.';
    if (ctrl.hasError('integer')) return 'Usa segundos enteros.';
    return 'Penalización demasiado grande.';
  }

  /** Tras guardar: con prueba fijada → siguiente grupo; si no → otra prueba del mismo grupo. */
  private goNext(group: Group, test: Test): void {
    const queryParams =
      this.pinnedTestId() === test.id ? { grupo: null, prueba: test.id } : { grupo: group.id, prueba: null };
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  private target(group: Group, test: Test): ScoreTarget {
    return {
      groupId: group.id,
      groupName: group.name,
      testId: test.id,
      testName: test.name,
    };
  }

  private prepareForm(key: string | null): void {
    const seq = ++this.loadSeq;
    const test = this.test();
    this.existing.set(null);
    this.loadError.set(null);
    this.editingTime.set(false);
    this.form.reset({ timeMs: null, penaltySeconds: 0 });

    const group = this.group();
    if (!key || !group || !test) return;

    // Solo se lee el resultado si el resumen indica que existe (ahorra lecturas).
    if (!this.store.result(group.id, test.id)) return;
    this.loadingExisting.set(true);
    this.scores
      .get(group.id, test.id)
      .then((score) => {
        if (seq !== this.loadSeq) return;
        this.existing.set(score);
        if (score) {
          this.form.reset({ timeMs: score.timeMs, penaltySeconds: Math.round(score.penaltyMs / 1000) });
        }
      })
      .catch((err: unknown) => {
        if (seq === this.loadSeq) this.loadError.set(describeError(err, 'No se ha podido cargar el resultado.'));
      })
      .finally(() => {
        if (seq === this.loadSeq) this.loadingExisting.set(false);
      });
  }
}
