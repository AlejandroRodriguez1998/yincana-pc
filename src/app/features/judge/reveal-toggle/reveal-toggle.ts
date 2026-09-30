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
    @if (variant() === 'card') {
      <section class="card card-pad reveal" [class.on]="revealed">
        <div class="row">
          <span class="state-icon"><app-icon [name]="revealed ? 'eye' : 'eye-off'" /></span>
          <div class="grow">
            <h2>Ranking para los grupos</h2>
            <p class="small muted">
              {{ revealed ? 'Revelado: los grupos ven su posición y el ranking general.'
                          : 'Oculto: los grupos solo ven sus propios tiempos, y en el ranking no se muestran totales ni posiciones.' }}
            </p>
          </div>
        </div>
        <button type="button" class="btn btn-block" [class.btn-primary]="!revealed" [class.btn-outline]="revealed"
                (click)="toggle()" [disabled]="busy() || feed.loading()">
          <app-icon [name]="revealed ? 'eye-off' : 'eye'" [size]="18" />
          {{ revealed ? 'Ocultar ranking a los grupos' : 'Revelar ranking a los grupos' }}
        </button>
      </section>
    } @else {
      <button type="button" class="chip" [class.on]="revealed" (click)="toggle()" [disabled]="busy() || feed.loading()"
              [attr.aria-label]="revealed ? 'Ranking visible para los grupos. Pulsa para ocultarlo' : 'Ranking oculto para los grupos. Pulsa para revelarlo'">
        <app-icon [name]="revealed ? 'eye' : 'eye-off'" [size]="16" />
        <span>{{ revealed ? 'Revelado' : 'Revelar' }}</span>
      </button>
    }
  `,
  styles: `
    .reveal {
      display: flex;
      flex-direction: column;
      gap: 12px;
      &.on {
        border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
      }
    }
    .state-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      border-radius: 12px;
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

  /** `card` en el panel del juez; `chip` en la barra del ranking. */
  readonly variant = input<'card' | 'chip'>('card');
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
