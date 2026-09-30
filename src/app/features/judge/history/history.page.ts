import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { AuditService } from '../../../core/data/audit.service';
import { describeError } from '../../../core/firebase/errors';
import { AuditAction, AuditLog, AuditValues } from '../../../core/models';
import { eventValue } from '../../../shared/dom';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { IconName } from '../../../shared/components/icon/icons';
import { formatDuration } from '../../../shared/pipes/duration.pipe';
import { JudgeStore } from '../judge.store';

const PAGE_SIZE = 20;
const dateFormat = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const ACTION_LABEL: Record<AuditAction, string> = {
  create: 'Nuevo',
  update: 'Modificado',
  delete: 'Eliminado',
};
const ACTION_ICON: Record<AuditAction, IconName> = { create: 'plus', update: 'edit', delete: 'trash' };

function describeScore(values: AuditValues | null): string {
  if (!values) return '—';
  const total = values['totalMs'];
  const penalty = values['penaltyMs'];
  if (typeof total !== 'number') return '—';
  let text = formatDuration(total);
  if (typeof penalty === 'number' && penalty > 0) text += ` (incl. +${formatDuration(penalty, false)})`;
  return text;
}

/**
 * Historial de auditoría. Solo jueces (también lo imponen las reglas).
 * Se carga por páginas bajo demanda: sin listener y sin leer la colección entera.
 */
@Component({
  selector: 'app-history-page',
  imports: [Icon, EmptyState, ErrorState],
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage {
  protected readonly store = inject(JudgeStore);
  private readonly audit = inject(AuditService);

  protected readonly entries = signal<readonly AuditLog[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly groupFilter = signal<string | null>(null);
  private cursor: QueryDocumentSnapshot | null = null;

  protected readonly actionLabel = ACTION_LABEL;
  protected readonly actionIcon = ACTION_ICON;
  protected readonly describeScore = describeScore;

  constructor() {
    void this.load(true);
  }

  protected formatDate(date: Date | null): string {
    return date ? dateFormat.format(date) : '—';
  }

  protected setFilter(event: Event): void {
    this.groupFilter.set(eventValue(event) || null);
    void this.load(true);
  }

  protected refresh(): void {
    void this.load(true);
  }

  protected loadMore(): void {
    void this.load(false);
  }

  private async load(reset: boolean): Promise<void> {
    if (reset) {
      this.cursor = null;
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    this.error.set(null);
    try {
      const page = await this.audit.page({ groupId: this.groupFilter(), cursor: this.cursor, size: PAGE_SIZE });
      this.cursor = page.cursor;
      this.hasMore.set(page.hasMore);
      this.entries.update((list) => (reset ? page.items : [...list, ...page.items]));
    } catch (err) {
      this.error.set(describeError(err, 'No se ha podido cargar el historial.'));
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }
}
