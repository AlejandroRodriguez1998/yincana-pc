import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaService } from '../../../core/pwa/pwa.service';
import { Icon } from '../icon/icon';

/** Aviso flotante de nueva versión desplegada. */
@Component({
  selector: 'app-update-banner',
  imports: [Icon],
  template: `
    @if (pwa.updateReady()) {
      <div class="banner" role="status" aria-live="polite">
        <app-icon name="refresh" [size]="18" />
        <span class="grow">Nueva versión disponible</span>
        <button type="button" class="btn btn-primary btn-sm" (click)="pwa.applyUpdate()">Recargar</button>
        <button type="button" class="icon-btn" (click)="pwa.dismissUpdate()" aria-label="Más tarde">
          <app-icon name="x" [size]="16" />
        </button>
      </div>
    }
  `,
  styles: `
    .banner {
      position: fixed;
      left: 50%;
      top: calc(env(safe-area-inset-top, 0px) + 10px);
      transform: translateX(-50%);
      z-index: 1100;
      display: flex;
      align-items: center;
      gap: 10px;
      width: min(440px, calc(100% - 24px));
      padding: 8px 6px 8px 14px;
      border-radius: 14px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      font-size: 0.9rem;
      font-weight: 600;
      app-icon {
        color: var(--primary);
      }
    }
    .grow {
      flex: 1;
    }
    .icon-btn {
      width: 32px;
      height: 32px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateBanner {
  protected readonly pwa = inject(PwaService);
}
