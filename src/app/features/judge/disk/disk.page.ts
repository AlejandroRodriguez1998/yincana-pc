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
import { configProblems, cryptoRandomInt, resizeSectors, validQuestion } from '../../../core/data/disk-plan';
import { DEFAULT_DISK_QUESTIONS } from '../../../core/data/disk-questions';
import {
  DiskService,
  newDiskConfig,
  toDiskInfo,
  toDiskRun,
  toDiskSecret,
} from '../../../core/data/disk.service';
import { COLLECTIONS } from '../../../core/data/paths';
import { ScoresService } from '../../../core/data/scores.service';
import { describeError } from '../../../core/firebase/errors';
import { liveQuery } from '../../../core/firebase/live';
import {
  DISK_CHAIN_MAX,
  DISK_LOCATION_MAX,
  DISK_OPTION_MAX,
  DISK_QUESTIONS_MAX,
  DISK_QUESTION_MAX,
  DISK_SECTORS_MAX,
  DiskConfig,
  DiskInfo,
  DiskQuestion,
  DiskRun,
  DiskSecret,
  Group,
  MAX_TIME_MS,
  Test,
  diskPhase,
  formatDiskCode,
} from '../../../core/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Sheet } from '../../../shared/components/sheet/sheet';
import { eventValue } from '../../../shared/dom';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { JudgeStore } from '../judge.store';

/** Estado de un grupo en la prueba, para la lista en directo. */
interface GroupRow {
  readonly group: Group;
  readonly info: DiskInfo | null;
  readonly secret: DiskSecret | null;
  readonly run: DiskRun | null;
  readonly status: string;
  readonly tone: 'idle' | 'live' | 'done';
  /** Tiempo y penalización calculados (solo si ha terminado). */
  readonly result: { timeMs: number; penaltyMs: number } | null;
  /** El resultado guardado coincide con el calculado. */
  readonly recorded: boolean;
}

interface QuestionDraft {
  text: string;
  options: string[];
  correct: number;
}

function clampInt(value: string, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

@Component({
  selector: 'app-disk-page',
  imports: [RouterLink, Icon, Sheet, EmptyState, ErrorState, DurationPipe],
  templateUrl: './disk.page.html',
  styleUrl: './disk.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiskPage {
  protected readonly store = inject(JudgeStore);
  private readonly disk = inject(DiskService);
  private readonly scores = inject(ScoresService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /** Parámetro de ruta (withComponentInputBinding). */
  readonly testId = input.required<string>();

  protected readonly limits = {
    sectors: DISK_SECTORS_MAX,
    chain: DISK_CHAIN_MAX,
    location: DISK_LOCATION_MAX,
    question: DISK_QUESTION_MAX,
    option: DISK_OPTION_MAX,
  };
  protected readonly value = eventValue;
  protected readonly formatCode = formatDiskCode;

  protected readonly test = computed<Test | null>(() => this.store.feed.testsById().get(this.testId()) ?? null);

  // ---------- Datos en directo de la prueba ----------
  // Se crean al conocer el testId (input disponible tras la creación).
  private readonly live = computed(() => {
    const testId = this.testId();
    return untracked(() => ({
      runs: liveQuery(this.disk.byTest(COLLECTIONS.diskRuns, testId), toDiskRun, this.destroyRef),
      infos: liveQuery(this.disk.byTest(COLLECTIONS.diskInfos, testId), toDiskInfo, this.destroyRef),
      secrets: liveQuery(this.disk.byTest(COLLECTIONS.diskSecrets, testId), toDiskSecret, this.destroyRef),
    }));
  });

  /** Reloj para los tiempos en curso. */
  protected readonly now = signal(Date.now());

  protected readonly rows = computed<readonly GroupRow[]>(() => {
    const { runs, infos, secrets } = this.live();
    const runBy = new Map(runs.value().map((r) => [r.groupId, r]));
    const infoBy = new Map(infos.value().map((i) => [i.groupId, i]));
    const secretBy = new Map(secrets.value().map((s) => [s.groupId, s]));
    const testId = this.testId();
    return this.store.activeGroups().map((group) => {
      const info = infoBy.get(group.id) ?? null;
      const secret = secretBy.get(group.id) ?? null;
      const run = runBy.get(group.id) ?? null;
      const saved = this.store.result(group.id, testId);
      let status = 'Sin disco: genera los discos';
      let tone: GroupRow['tone'] = 'idle';
      let result: GroupRow['result'] = null;
      if (info && !run) {
        status = info.unlocked ? 'Acceso dado · esperando a que empiecen' : 'Disco listo · sin acceso';
      } else if (info && run) {
        const phase = diskPhase(run, info.count);
        const label = secret?.labels[run.step] ?? '¿?';
        tone = phase === 'done' ? 'done' : 'live';
        status =
          phase === 'locate'
            ? `Buscando el sector ${label} · ${run.step}/${info.count}`
            : phase === 'question'
              ? `Respondiendo en ${label} · ${run.step}/${info.count}`
              : phase === 'rebuild'
                ? 'Reconstruyendo el archivo'
                : 'Terminado';
        if (phase === 'done' && run.startedAt && run.finishedAt) {
          result = {
            timeMs: Math.min(MAX_TIME_MS, Math.max(1, run.finishedAt.getTime() - run.startedAt.getTime())),
            penaltyMs: Math.min(MAX_TIME_MS, run.wrong * info.penaltyMs),
          };
        }
      }
      const recorded =
        !!result && !!saved && saved.totalMs === result.timeMs + result.penaltyMs && saved.penaltyMs === result.penaltyMs;
      return { group, info, secret, run, status, tone, result, recorded };
    });
  });

  protected readonly liveLoading = computed(() => {
    const { runs, infos, secrets } = this.live();
    return runs.loading() || infos.loading() || secrets.loading();
  });
  protected readonly liveError = computed(() => {
    const { runs, infos, secrets } = this.live();
    return runs.error() ?? infos.error() ?? secrets.error();
  });
  protected readonly missing = computed(() => this.rows().filter((r) => !r.info).map((r) => r.group));
  protected readonly started = computed(() => this.rows().filter((r) => r.run).length);
  /** Grupos con disco, sin empezar y sin acceso. */
  protected readonly locked = computed(() => this.rows().filter((r) => r.info && !r.info.unlocked && !r.run));
  protected readonly toRecord = computed(() => this.rows().filter((r) => r.result && !r.recorded));

  // ---------- Configuración (borrador local) ----------

  protected readonly config = signal<DiskConfig | null>(null);
  protected readonly configError = signal<string | null>(null);
  protected readonly dirty = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly problems = computed(() => {
    const config = this.config();
    return config ? configProblems(config) : [];
  });

  /** Pregunta en edición: índice, 'new' o null. */
  protected readonly editingQuestion = signal<number | 'new' | null>(null);
  protected readonly questionDraft = signal<QuestionDraft>({ text: '', options: [], correct: 0 });
  protected readonly showCodes = signal(false);

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    effect(() => {
      const testId = this.testId();
      untracked(() => void this.loadConfig(testId));
    });
  }

  private async loadConfig(testId: string): Promise<void> {
    this.config.set(null);
    this.configError.set(null);
    try {
      const saved = await this.disk.loadConfig(testId);
      this.config.set(saved ?? newDiskConfig());
      this.dirty.set(!saved);
    } catch (err) {
      this.configError.set(describeError(err, 'No se ha podido cargar la configuración.'));
    }
  }

  private patch(change: Partial<DiskConfig>): void {
    const config = this.config();
    if (!config) return;
    this.config.set({ ...config, ...change });
    this.dirty.set(true);
  }

  protected setSectorCount(text: string): void {
    const config = this.config();
    if (!config) return;
    const count = clampInt(text, 1, DISK_SECTORS_MAX);
    if (count === config.sectors.length) return;
    this.patch({ sectors: resizeSectors(config.sectors, count, cryptoRandomInt) });
  }

  protected setLocation(index: number, location: string): void {
    const config = this.config();
    if (!config) return;
    this.patch({ sectors: config.sectors.map((s, i) => (i === index ? { ...s, location } : s)) });
  }

  protected setChainLength(text: string): void {
    this.patch({ chainLength: clampInt(text, 1, DISK_CHAIN_MAX) });
  }

  protected setPenalty(text: string): void {
    this.patch({ penaltySeconds: clampInt(text, 0, 600) });
  }

  protected setDigits(text: string): void {
    this.patch({ fragmentDigits: clampInt(text, 1, 8) });
  }

  protected async save(): Promise<boolean> {
    const config = this.config();
    if (!config) return false;
    this.busy.set('save');
    try {
      await this.disk.saveConfig(this.testId(), config);
      this.dirty.set(false);
      return true;
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido guardar la configuración.'));
      return false;
    } finally {
      this.busy.set(null);
    }
  }

  protected async saveClick(): Promise<void> {
    if (await this.save()) this.toast.success('Configuración guardada.');
  }

  /** Las tarjetas se imprimen desde la configuración guardada. */
  protected async openPrint(): Promise<void> {
    if (this.dirty() && !(await this.save())) return;
    void this.router.navigate(['/disco', this.testId(), 'imprimir']);
  }

  // ---------- Preguntas ----------

  protected openQuestion(index: number | 'new'): void {
    const q: DiskQuestion =
      index === 'new' ? { text: '', options: ['', '', '', ''], correct: 0 } : this.config()!.questions[index];
    this.questionDraft.set({ text: q.text, options: [...q.options], correct: q.correct });
    this.editingQuestion.set(index);
  }

  protected draftText(text: string): void {
    this.questionDraft.update((d) => ({ ...d, text }));
  }

  protected draftOption(index: number, text: string): void {
    this.questionDraft.update((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? text : o)) }));
  }

  protected draftCorrect(index: number): void {
    this.questionDraft.update((d) => ({ ...d, correct: index }));
  }

  protected addOption(): void {
    this.questionDraft.update((d) => (d.options.length < 6 ? { ...d, options: [...d.options, ''] } : d));
  }

  protected removeOption(index: number): void {
    this.questionDraft.update((d) => {
      if (d.options.length <= 2) return d;
      const options = d.options.filter((_, i) => i !== index);
      const correct = d.correct === index ? 0 : d.correct > index ? d.correct - 1 : d.correct;
      return { ...d, options, correct };
    });
  }

  protected draftValid(): boolean {
    return validQuestion(this.questionDraft());
  }

  protected commitQuestion(): void {
    const config = this.config();
    const target = this.editingQuestion();
    if (!config || target === null || !this.draftValid()) return;
    const q = this.questionDraft();
    const question: DiskQuestion = { text: q.text.trim(), options: q.options.map((o) => o.trim()), correct: q.correct };
    const questions =
      target === 'new' ? [...config.questions, question] : config.questions.map((x, i) => (i === target ? question : x));
    this.patch({ questions: questions.slice(0, DISK_QUESTIONS_MAX) });
    this.editingQuestion.set(null);
  }

  protected removeQuestion(): void {
    const config = this.config();
    const target = this.editingQuestion();
    if (!config || typeof target !== 'number') return;
    this.patch({ questions: config.questions.filter((_, i) => i !== target) });
    this.editingQuestion.set(null);
  }

  protected async restoreQuestions(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Restaurar preguntas',
      message: 'Se sustituirán las preguntas actuales por el banco inicial.',
      confirmLabel: 'Restaurar',
    });
    if (ok) this.patch({ questions: DEFAULT_DISK_QUESTIONS });
  }

  // ---------- Discos ----------

  protected async generate(all: boolean): Promise<void> {
    const config = this.config();
    if (!config) return;
    const groups = all ? this.store.activeGroups() : this.missing();
    if (all && this.started() > 0) {
      const ok = await this.confirm.ask({
        title: 'Regenerar todos los discos',
        message:
          `${this.started()} grupos ya han empezado: perderán su avance y tendrán una cadena nueva. ` +
          'Los tiempos ya registrados no se tocan. Las tarjetas impresas siguen valiendo.',
        confirmLabel: 'Regenerar',
        danger: true,
      });
      if (!ok) return;
    }
    if (this.dirty() && !(await this.save())) return;
    this.busy.set('generate');
    try {
      await this.disk.generate(this.testId(), config, groups);
      this.toast.success(`Discos generados para ${groups.length} grupos.`);
    } catch (err) {
      this.toast.error(describeError(err, 'No se han podido generar los discos.'));
    } finally {
      this.busy.set(null);
    }
  }

  protected async setAccess(rows: readonly GroupRow[], unlocked: boolean): Promise<void> {
    if (rows.length === 0) return;
    this.busy.set(rows.length === 1 ? rows[0].group.id : 'access');
    try {
      await this.disk.setUnlocked(
        this.testId(),
        rows.map((r) => r.group.id),
        unlocked,
      );
      this.toast.success(
        rows.length === 1
          ? `${rows[0].group.name}: ${unlocked ? 'acceso dado' : 'acceso quitado'}.`
          : `Acceso dado a ${rows.length} grupos.`,
      );
    } catch (err) {
      this.toast.error(describeError(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected async reset(row: GroupRow): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Reiniciar a ${row.group.name}`,
      message:
        'Se borrará su avance y volverá a "sin empezar", sin acceso, con el mismo disco. ' +
        'El tiempo registrado (si lo hay) no se toca.',
      confirmLabel: 'Reiniciar',
      danger: true,
    });
    if (!ok) return;
    this.busy.set(row.group.id);
    try {
      await this.disk.resetRun(this.testId(), row.group.id);
      this.toast.success(`${row.group.name}: partida reiniciada. Dale acceso cuando estén listos.`);
    } catch (err) {
      this.toast.error(describeError(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected async record(row: GroupRow): Promise<boolean> {
    const test = this.test();
    if (!test || !row.result) return false;
    this.busy.set(row.group.id);
    try {
      await this.scores.save(
        { groupId: row.group.id, groupName: row.group.name, testId: test.id, testName: test.name },
        row.result,
        this.store.feed.activeTestIds(),
      );
      return true;
    } catch (err) {
      this.toast.error(describeError(err, `No se ha podido registrar a ${row.group.name}.`));
      return false;
    } finally {
      this.busy.set(null);
    }
  }

  protected async recordOne(row: GroupRow): Promise<void> {
    if (await this.record(row)) this.toast.success(`${row.group.name}: tiempo registrado.`);
  }

  protected async recordAll(): Promise<void> {
    let ok = 0;
    for (const row of this.toRecord()) {
      if (await this.record(row)) ok++;
    }
    if (ok) this.toast.success(`${ok} tiempos registrados.`);
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected elapsed(run: DiskRun): number {
    const start = run.startedAt?.getTime() ?? this.now();
    const end = run.finishedAt?.getTime() ?? this.now();
    return Math.max(0, end - start);
  }
}
