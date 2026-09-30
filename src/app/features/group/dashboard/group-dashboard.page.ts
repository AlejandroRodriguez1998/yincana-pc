import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { PwaService } from '../../../core/pwa/pwa.service';
import { ThemeService } from '../../../core/ui/theme.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { RankingList } from '../../../shared/components/ranking-list/ranking-list';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { GroupStore } from '../group.store';

@Component({
  selector: 'app-group-dashboard',
  imports: [Icon, RankingList, EmptyState, ErrorState, DurationPipe],
  templateUrl: './group-dashboard.page.html',
  styleUrl: './group-dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDashboardPage {
  protected readonly store = inject(GroupStore);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly pwa = inject(PwaService);

  protected readonly totalGroups = computed(() => this.store.feed.ranking().length);

  protected logout(): void {
    void this.auth.logout();
  }
}
