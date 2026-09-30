import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icons';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `
    <div class="empty">
      <div class="icon-wrap"><app-icon [name]="icon()" [size]="26" /></div>
      <h3>{{ heading() }}</h3>
      @if (text()) {
        <p>{{ text() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 20px;
      text-align: center;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-lg);
    }
    .icon-wrap {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      margin-bottom: 4px;
      border-radius: 14px;
      background: var(--primary-soft);
      color: var(--primary);
    }
    p {
      max-width: 340px;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input<IconName>('cpu');
  readonly heading = input.required<string>();
  readonly text = input<string>('');
}
