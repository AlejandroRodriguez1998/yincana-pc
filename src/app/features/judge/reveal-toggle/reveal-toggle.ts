import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CompetitionFeed } from '../../../core/data/competition-feed';
import { SettingsService } from '../../../core/data/settings.service';
import { describeError } from '../../../core/firebase/errors';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../../../shared/components/icon/icon';

/**
 * Revela u oculta el ranking a los grupos. Mientras está oculto, los grupos
 * solo ven sus propios resultados (sin posición ni ranking general).
 */
@Component({
  selector: 'app-reveal-toggle',
  imports: [Icon],
  template: `
    @let revealed = feed.rankingRevealed();
    @if (variant() === 'footer') {
      <div class="footer" [class.on]="revealed">
        <span class="state-icon"><app-icon [name]="revealed ? 'eye' : 'eye-off'" [size]="18" /></span>
        <div class="grow">
          <strong class="footer-title">{{ revealed ? 'Visible para los grupos' : 'Oculto para los grupos' }}</strong>
          <span class="small muted footer-sub">
            {{ revealed ? 'Ven su posición y el ranking general.' : 'Solo ven sus propios tiempos.' }}
          </span>
        </div>
        <button type="button" class="btn btn-sm" [class.btn-primary]="!revealed" [class.btn-outline]="revealed"
                (click)="toggle()" [disabled]="busy() || feed.loading()"
                [attr.aria-label]="revealed ? 'Ocultar ranking a los grupos' : 'Revelar ranking a los grupos'">
          <app-icon [name]="revealed ? 'eye-off' : 'eye'" [size]="16" />
          {{ revealed ? 'Ocultar' : 'Revelar' }}
        </button>
      </div>
    } @else {
      <button type="button" class="chip" [class.on]="revealed" (click)="toggle()" [disabled]="busy() || feed.loading()"
              [attr.aria-label]="revealed ? 'Ranking visible para los grupos. Pulsa para ocultarlo' : 'Ranking oculto para los grupos. Pulsa para revelarlo'">
        <app-icon [name]="revealed ? 'eye' : 'eye-off'" [size]="16" />
        <span>{{ revealed ? 'Revelado' : 'Revelar' }}</span>
      </button>
    }
  `,
  styles: `
    .footer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      background: var(--surface-2);
      &.on {
        background: color-mix(in srgb, var(--accent) 8%, var(--surface));
      }
    }
    .footer-title {
      display: block;
      font-size: 0.9rem;
    }
    .footer-sub {
      display: block;
    }
    .state-icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      border-radius: 10px;
      background: var(--surface-2);
      color: var(--text-muted);
    }
    .on .state-icon {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 42px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid #22324a;
      background: #0f1724;
      color: #93a3bb;
      font-size: 0.85em;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      &.on {
        color: #2fcf8f;
        border-color: rgba(47, 207, 143, 0.45);
        background: rgba(47, 207, 143, 0.12);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevealToggle {
  protected readonly feed = inject(CompetitionFeed);
  private readonly settings = inject(SettingsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  /** `footer`: pie de la tarjeta del Top 3 (panel del juez); `chip`: barra del ranking. */
  readonly variant = input<'footer' | 'chip'>('footer');
  protected readonly busy = signal(false);

  protected async toggle(): Promise<void> {
    const reveal = !this.feed.rankingRevealed();
    const ok = await this.confirm.ask(
      reveal
        ? {
            title: 'Revelar ranking',
            message:
              'Se desvelará el podio con animación (3º, 2º y ganador) y después la tabla con tiempos totales y posiciones. Los grupos verán su posición y el ranking cuando termine la animación. Podrás volver a ocultarlo.',
            confirmLabel: 'Revelar',
          }
        : {
            title: 'Ocultar ranking',
            message: 'Los grupos dejarán de ver su posición y el ranking general.',
            confirmLabel: 'Ocultar',
          },
    );
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.settings.setRankingRevealed(reveal);
      this.toast.success(reveal ? 'Ranking revelado a los grupos.' : 'Ranking oculto a los grupos.');
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido cambiar la visibilidad del ranking.'));
    } finally {
      this.busy.set(false);
    }
  }
}
