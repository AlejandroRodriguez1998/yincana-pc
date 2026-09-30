import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Hoja modal accesible basada en <dialog>: se desliza desde abajo en móvil
 * y aparece centrada en escritorio. Gestiona foco, Escape y fondo.
 */
@Component({
  selector: 'app-sheet',
  imports: [Icon],
  template: `
    <dialog
      #dialog
      class="sheet"
      [attr.aria-labelledby]="titleId"
      (close)="closed.emit()"
      (click)="onBackdropClick($event)"
    >
      <div class="sheet-inner">
        <header class="sheet-head">
          <h2 [id]="titleId">{{ heading() }}</h2>
          <button type="button" class="icon-btn" (click)="closed.emit()" aria-label="Cerrar">
            <app-icon name="x" />
          </button>
        </header>
        <div class="sheet-body">
          <ng-content />
        </div>
      </div>
    </dialog>
  `,
  styleUrl: './sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sheet {
  private static nextId = 0;

  readonly open = input.required<boolean>();
  readonly heading = input.required<string>();
  readonly closed = output<void>();

  protected readonly titleId = `sheet-title-${Sheet.nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) {
        el.showModal();
      } else if (!this.open() && el.open) {
        el.close();
      }
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.closed.emit();
    }
  }
}
