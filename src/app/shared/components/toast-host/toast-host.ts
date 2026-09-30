import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div [class]="'toast toast-' + toast.kind">
          <app-icon
            [name]="toast.kind === 'error' ? 'alert' : toast.kind === 'success' ? 'check' : 'zap'"
            [size]="18"
          />
          <span class="grow">{{ toast.message }}</span>
          <button type="button" class="close" (click)="toasts.dismiss(toast.id)" aria-label="Cerrar aviso">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      left: 50%;
      top: calc(env(safe-area-inset-top, 0px) + 12px);
      transform: translateX(-50%);
      width: min(480px, calc(100% - 24px));
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 1000;
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 8px 10px 14px;
      border-radius: 12px;
      background: var(--text);
      color: var(--bg);
      box-shadow: var(--shadow-lg);
      font-size: 0.9rem;
      font-weight: 500;
      pointer-events: auto;
      animation: toast-in 0.2s ease-out;
    }
    .toast-success app-icon {
      color: var(--accent);
    }
    .toast-error {
      background: var(--danger);
      color: #fff;
    }
    .close {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      opacity: 0.7;
      cursor: pointer;
    }
    .grow {
      flex: 1;
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
}
