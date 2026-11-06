import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InProgress } from '../../../core/models';
import { injectNow, sinceLabel } from '../../time/now';

/**
 * Estado en directo de una prueba: libre u ocupada (y desde cuándo).
 * Los jueces ven también qué grupo la está haciendo; los grupos, solo si están
 * ellos ("Estáis aquí").
 */
@Component({
  selector: 'app-test-status',
  template: `
    @if (entries().length === 0) {
      <span class="badge badge-success st"><span class="dot"></span>Libre</span>
    } @else if (isOwn()) {
      <span class="badge badge-primary st"><span class="dot pulse"></span>Estáis aquí · {{ since() }}</span>
    } @else {
      <span class="badge badge-warning st" [attr.title]="title()">
        <span class="dot pulse"></span>
        <span class="txt">Ocupada{{ detail() }} · {{ since() }}</span>
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
      max-width: 100%;
    }
    .st {
      min-width: 0;
      max-width: 100%;
      white-space: nowrap;
    }
    .txt {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dot {
      flex-shrink: 0;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .pulse {
      animation: st-pulse 1.4s ease-in-out infinite;
    }
    @keyframes st-pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 55%, transparent);
      }
      50% {
        box-shadow: 0 0 0 4px transparent;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestStatus {
  /** Grupos haciendo la prueba ahora mismo (vacío si está libre). */
  readonly entries = input<readonly InProgress[]>([]);
  /** Muestra qué grupo la ocupa (solo jueces). */
  readonly showGroup = input(false);
  /** Grupo que mira la pantalla (zona de grupos), para mostrar "Estáis aquí". */
  readonly ownGroupId = input<string | null>(null);

  private readonly now = injectNow();

  protected readonly isOwn = computed(() => {
    const own = this.ownGroupId();
    return !!own && this.entries().some((e) => e.groupId === own);
  });
  protected readonly since = computed(() => sinceLabel(this.entries()[0]?.startedAt ?? null, this.now()));
  protected readonly detail = computed(() => {
    const entries = this.entries();
    if (!this.showGroup() || entries.length === 0) return '';
    return ` · ${entries[0].groupName}${entries.length > 1 ? ` +${entries.length - 1}` : ''}`;
  });
  protected readonly title = computed(() =>
    this.showGroup() ? this.entries().map((e) => `${e.groupName} (juez: ${e.judgeName})`).join(', ') : null,
  );
}
