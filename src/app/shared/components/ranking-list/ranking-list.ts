import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RankingEntry } from '../../../core/models';
import { DurationPipe } from '../../pipes/duration.pipe';

/** Lista compacta de clasificación (móvil). La pantalla final usa su propia tabla. */
@Component({
  selector: 'app-ranking-list',
  imports: [DurationPipe],
  template: `
    <ol class="list ranking" [attr.aria-label]="label()">
      @for (entry of entries(); track entry.groupId) {
        <li class="row-item" [class.me]="entry.groupId === highlightId()">
          <span class="rank" [class]="'rank rank-' + entry.position">{{ entry.position }}</span>
          <div class="grow">
            <div class="item-title">
              {{ entry.name }}
              @if (entry.groupId === highlightId()) {
                <span class="badge badge-primary">Tu grupo</span>
              }
            </div>
            <div class="item-sub">
              {{ entry.completed }}/{{ totalTests() }} pruebas
              @if (entry.tied) {
                · empate
              }
            </div>
          </div>
          <div class="total">
            <strong class="mono">{{ entry.completed ? (entry.totalMs | duration) : '—' }}</strong>
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .row-item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 58px;
      padding: 8px 14px;
      & + & {
        border-top: 1px solid var(--border);
      }
    }
    .me {
      background: var(--primary-soft);
    }
    .item-title {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .total {
      font-size: 1.05rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingList {
  readonly entries = input.required<readonly RankingEntry[]>();
  readonly totalTests = input.required<number>();
  readonly highlightId = input<string | null>(null);
  readonly label = input('Clasificación');
}
