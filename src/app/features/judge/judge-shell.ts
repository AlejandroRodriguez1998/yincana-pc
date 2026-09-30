import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CompetitionFeed } from '../../core/data/competition-feed';
import { PwaService } from '../../core/pwa/pwa.service';
import { ThemeService } from '../../core/ui/theme.service';
import { Icon } from '../../shared/components/icon/icon';
import { Sheet } from '../../shared/components/sheet/sheet';
import { JudgeStore } from './judge.store';

@Component({
  selector: 'app-judge-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Sheet],
  providers: [CompetitionFeed, JudgeStore],
  templateUrl: './judge-shell.html',
  styleUrl: './judge-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JudgeShell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly pwa = inject(PwaService);
  protected readonly menuOpen = signal(false);

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected async logout(): Promise<void> {
    this.closeMenu();
    await this.auth.logout();
  }
}
