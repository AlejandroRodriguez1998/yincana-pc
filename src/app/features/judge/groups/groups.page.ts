import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GroupsService, newParticipantId } from '../../../core/data/groups.service';
import { describeError } from '../../../core/firebase/errors';
import { GROUP_NAME_MAX, PARTICIPANTS_MAX } from '../../../core/models';
import { ToastService } from '../../../core/ui/toast.service';
import { eventValue } from '../../../shared/dom';
import { groupBadge } from '../../../shared/group-badge';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Sheet } from '../../../shared/components/sheet/sheet';
import { JudgeStore } from '../judge.store';

@Component({
  selector: 'app-groups-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, Sheet, EmptyState, ErrorState],
  templateUrl: './groups.page.html',
  styleUrl: './groups.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsPage {
  protected readonly store = inject(JudgeStore);
  private readonly groupsService = inject(GroupsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly value = eventValue;
  protected readonly badge = groupBadge;
  protected readonly search = signal('');
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly nameMax = GROUP_NAME_MAX;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(GROUP_NAME_MAX)]],
    participants: [''],
  });

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const groups = this.store.groups();
    return term ? groups.filter((g) => g.name.toLowerCase().includes(term)) : groups;
  });

  protected openCreate(): void {
    this.form.reset({ name: `Grupo ${this.store.groups().length + 1}`, participants: '' });
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, participants } = this.form.getRawValue();
    const names = participants
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length > PARTICIPANTS_MAX) {
      this.toast.error(`Máximo ${PARTICIPANTS_MAX} participantes por grupo.`);
      return;
    }
    this.saving.set(true);
    try {
      const id = await this.groupsService.create({
        name,
        active: true,
        participants: names.map((n) => ({ id: newParticipantId(), name: n })),
      });
      this.creating.set(false);
      this.toast.success(`Grupo "${name.trim()}" creado.`);
      await this.router.navigate(['/juez/grupos', id]);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido crear el grupo.'));
    } finally {
      this.saving.set(false);
    }
  }
}
