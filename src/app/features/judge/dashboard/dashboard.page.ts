import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { InProgressService } from '../../../core/data/in-progress.service';
import { StandingsService } from '../../../core/data/standings.service';
import { describeError } from '../../../core/firebase/errors';
import { InProgress, Test } from '../../../core/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { RankingList } from '../../../shared/components/ranking-list/ranking-list';
import { TestStatus } from '../../../shared/components/test-status/test-status';
import { JudgeStore } from '../judge.store';
import { RevealToggle } from '../reveal-toggle/reveal-toggle';

@Component({
  selector: 'app-judge-dashboard',
  imports: [RouterLink, Icon, RankingList, EmptyState, ErrorState, RevealToggle, TestStatus],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(JudgeStore);
  private readonly standings = inject(StandingsService);
  private readonly inProgress = inject(InProgressService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly top = computed(() => this.store.feed.ranking().slice(0, 3));
  protected readonly rebuilding = signal(false);
  protected readonly freeCount = computed(() => this.store.feed.freeTestIds().size);
  protected readonly busyCount = computed(
    () => this.store.feed.activeTests().length - this.freeCount(),
  );

  /** Libera a mano una prueba (p. ej. si un juez cerró la app sin guardar ni reiniciar). */
  protected async release(test: Test, entries: readonly InProgress[]): Promise<void> {
    const names = entries.map((e) => e.groupName).join(', ');
    const ok = await this.confirm.ask({
      title: 'Liberar prueba',
      message: `"${test.name}" dejará de aparecer ocupada por ${names}. Úsalo si el grupo ya no está en la prueba (p. ej. se cerró la app sin guardar).`,
      confirmLabel: 'Liberar',
    });
    if (!ok) return;
    try {
      await Promise.all(entries.map((e) => this.inProgress.finish(e.groupId, e.testId)));
      this.toast.success(`"${test.name}" está libre.`);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido liberar la prueba.'));
    }
  }

  protected async rebuild(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Recalcular clasificación',
      message:
        'Se reconstruirá el ranking leyendo todos los resultados guardados. Úsalo solo si el ranking no coincide con los resultados.',
      confirmLabel: 'Recalcular',
    });
    if (!ok) return;
    this.rebuilding.set(true);
    try {
      await this.standings.rebuild(this.store.feed.activeTestIds());
      this.toast.success('Clasificación recalculada.');
    } catch (err) {
      this.toast.error(describeError(err));
    } finally {
      this.rebuilding.set(false);
    }
  }
}
