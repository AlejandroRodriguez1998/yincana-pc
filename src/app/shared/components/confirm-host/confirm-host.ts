import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { Sheet } from '../sheet/sheet';

@Component({
  selector: 'app-confirm-host',
  imports: [Sheet],
  template: `
    @let req = confirm.request();
    <app-sheet [open]="!!req" [heading]="req?.title ?? ''" (closed)="req?.resolve(false)">
      @if (req) {
        <p class="message">{{ req.message }}</p>
        <div class="actions">
          <button type="button" class="btn btn-outline" (click)="req.resolve(false)">
            {{ req.cancelLabel ?? 'Cancelar' }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="req.danger"
            [class.btn-primary]="!req.danger"
            (click)="req.resolve(true)"
          >
            {{ req.confirmLabel ?? 'Confirmar' }}
          </button>
        </div>
      }
    </app-sheet>
  `,
  styles: `
    .message {
      color: var(--text-muted);
      white-space: pre-line;
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 20px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmHost {
  protected readonly confirm = inject(ConfirmService);
}
