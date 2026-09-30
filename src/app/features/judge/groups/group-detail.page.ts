import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountAdminService, CreatedAccount } from '../../../core/auth/account-admin.service';
import { USERNAME_PATTERN, generatePassword, suggestUsername } from '../../../core/auth/account-email';
import { GroupsService, newParticipantId } from '../../../core/data/groups.service';
import { UsersService } from '../../../core/data/users.service';
import { describeError } from '../../../core/firebase/errors';
import {
  GROUP_NAME_MAX,
  Group,
  PARTICIPANTS_MAX,
  PARTICIPANT_NAME_MAX,
  UserProfile,
} from '../../../core/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Sheet } from '../../../shared/components/sheet/sheet';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { JudgeStore } from '../judge.store';
import { CredentialsCard } from '../../../shared/components/credentials-card/credentials-card';

type ParticipantForm = FormGroup<{
  id: FormControl<string>;
  name: FormControl<string>;
}>;

@Component({
  selector: 'app-group-detail-page',
  imports: [ReactiveFormsModule, RouterLink, Icon, Sheet, EmptyState, DurationPipe, CredentialsCard],
  templateUrl: './group-detail.page.html',
  styleUrl: './group-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetailPage {
  protected readonly store = inject(JudgeStore);
  private readonly groupsService = inject(GroupsService);
  private readonly users = inject(UsersService);
  private readonly accounts = inject(AccountAdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Parámetro de ruta :groupId. */
  readonly groupId = input.required<string>();

  protected readonly group = computed<Group | null>(() => this.store.groupsById().get(this.groupId()) ?? null);
  protected readonly nameMax = GROUP_NAME_MAX;
  protected readonly participantMax = PARTICIPANT_NAME_MAX;
  protected readonly participantsMax = PARTICIPANTS_MAX;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(GROUP_NAME_MAX)]],
    active: [true],
    participants: this.fb.array<ParticipantForm>([]),
  });
  protected readonly newParticipant = this.fb.control('', [Validators.maxLength(PARTICIPANT_NAME_MAX)]);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);

  // Accesos (lectura puntual bajo demanda, sin listener)
  protected readonly accountList = signal<readonly UserProfile[] | null>(null);
  protected readonly accountsError = signal<string | null>(null);
  protected readonly accessOpen = signal(false);
  protected readonly creatingAccess = signal(false);
  protected readonly created = signal<CreatedAccount | null>(null);
  protected readonly accessForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(USERNAME_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly results = computed(() => {
    const group = this.group();
    if (!group) return [];
    return this.store.feed.activeTests().map((test) => ({ test, result: this.store.result(group.id, test.id) }));
  });

  private loadedFor: string | null = null;

  constructor() {
    // Rellena el formulario al cargar el grupo. Las actualizaciones en directo
    // posteriores no pisan lo que el juez esté editando.
    effect(() => {
      const group = this.group();
      untracked(() => {
        if (group && (this.loadedFor !== group.id || this.form.pristine)) {
          this.fillForm(group);
        }
        if (group && this.loadedFor !== group.id) {
          this.loadedFor = group.id;
          void this.loadAccounts(group.id);
        }
      });
    });
  }

  protected get participants(): FormArray<ParticipantForm> {
    return this.form.controls.participants;
  }

  protected addParticipant(): void {
    const name = this.newParticipant.value.trim();
    if (!name) return;
    if (this.participants.length >= PARTICIPANTS_MAX) {
      this.toast.error(`Máximo ${PARTICIPANTS_MAX} participantes.`);
      return;
    }
    this.participants.push(this.participantControl(newParticipantId(), name));
    this.participants.markAsDirty();
    this.newParticipant.reset('');
  }

  protected removeParticipant(index: number): void {
    this.participants.removeAt(index);
    this.participants.markAsDirty();
  }

  protected async save(): Promise<void> {
    const group = this.group();
    if (!group || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    try {
      await this.groupsService.update(group.id, {
        name: value.name,
        active: value.active,
        participants: value.participants,
      });
      this.form.markAsPristine();
      this.toast.success('Grupo guardado.');
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido guardar el grupo.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const group = this.group();
    if (!group) return;
    const done = this.store.completedByGroup().get(group.id) ?? 0;
    const ok = await this.confirm.ask({
      title: `Eliminar "${group.name}"`,
      message:
        `Se eliminarán el grupo, sus ${done} resultados y sus accesos. Esta acción no se puede deshacer.\n\n` +
        'Si solo quieres sacarlo de la competición, desactívalo.',
      confirmLabel: 'Eliminar grupo',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.groupsService.delete(group);
      this.toast.success(`Grupo "${group.name}" eliminado.`);
      await this.router.navigateByUrl('/juez/grupos');
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido eliminar el grupo.'));
      this.deleting.set(false);
    }
  }

  // ---------- Accesos ----------

  protected openAccess(): void {
    const group = this.group();
    if (!group) return;
    const base = suggestUsername(group.name) || 'grupo';
    const taken = (this.accountList() ?? []).length;
    this.accessForm.reset({
      username: taken ? `${base}-${taken + 1}`.slice(0, 30) : base.padEnd(3, '0'),
      password: generatePassword(),
    });
    this.created.set(null);
    this.accessOpen.set(true);
  }

  protected regeneratePassword(): void {
    this.accessForm.controls.password.setValue(generatePassword());
  }

  protected async createAccess(): Promise<void> {
    const group = this.group();
    if (!group || this.creatingAccess()) return;
    if (this.accessForm.invalid) {
      this.accessForm.markAllAsTouched();
      return;
    }
    const { username, password } = this.accessForm.getRawValue();
    this.creatingAccess.set(true);
    try {
      const account = await this.accounts.createAccount({
        username,
        password,
        displayName: group.name,
        role: 'group',
        groupId: group.id,
      });
      this.created.set(account);
      this.toast.success('Acceso creado.');
      void this.loadAccounts(group.id);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido crear el acceso.'));
    } finally {
      this.creatingAccess.set(false);
    }
  }

  protected async revoke(account: UserProfile): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Retirar acceso',
      message: `El usuario "${account.username}" dejará de poder entrar a la zona del grupo.`,
      confirmLabel: 'Retirar acceso',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.users.revokeAccess(account.uid);
      this.accountList.update((list) => (list ?? []).filter((a) => a.uid !== account.uid));
      this.toast.success('Acceso retirado.');
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido retirar el acceso.'));
    }
  }

  private async loadAccounts(groupId: string): Promise<void> {
    this.accountsError.set(null);
    try {
      this.accountList.set(await this.users.listGroupAccounts(groupId));
    } catch (err) {
      this.accountsError.set(describeError(err, 'No se han podido cargar los accesos.'));
    }
  }

  private fillForm(group: Group): void {
    this.participants.clear({ emitEvent: false });
    group.participants.forEach((p) => this.participants.push(this.participantControl(p.id, p.name), { emitEvent: false }));
    this.form.reset({
      name: group.name,
      active: group.active,
      participants: group.participants.map((p) => ({ id: p.id, name: p.name })),
    });
  }

  private participantControl(id: string, name: string): ParticipantForm {
    return this.fb.group({
      id: this.fb.control(id),
      name: this.fb.control(name, [Validators.required, Validators.maxLength(PARTICIPANT_NAME_MAX)]),
    });
  }
}
