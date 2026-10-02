import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountAdminService, CreatedAccount } from '../../../core/auth/account-admin.service';
import { USERNAME_PATTERN, generatePassword } from '../../../core/auth/account-email';
import { AuthService } from '../../../core/auth/auth.service';
import { JudgeRequestsService } from '../../../core/data/judge-requests.service';
import { UsersService } from '../../../core/data/users.service';
import { describeError } from '../../../core/firebase/errors';
import { JudgeRequest, UserProfile } from '../../../core/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { CredentialsCard } from '../../../shared/components/credentials-card/credentials-card';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Sheet } from '../../../shared/components/sheet/sheet';

@Component({
  selector: 'app-judges-page',
  imports: [ReactiveFormsModule, Icon, Sheet, ErrorState, CredentialsCard],
  templateUrl: './judges.page.html',
  styleUrl: './judges.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JudgesPage {
  protected readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly requestsService = inject(JudgeRequestsService);
  private readonly accounts = inject(AccountAdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly judges = signal<readonly UserProfile[] | null>(null);
  /** Solicitudes de /alta-jueces pendientes de aprobar. */
  protected readonly requests = signal<readonly JudgeRequest[] | null>(null);
  protected readonly requestsError = signal<string | null>(null);
  protected readonly reviewing = signal<string | null>(null);
  private readonly dateFormat = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  protected readonly error = signal<string | null>(null);
  protected readonly open = signal(false);
  protected readonly creating = signal(false);
  protected readonly created = signal<CreatedAccount | null>(null);

  /** Enlace de autoregistro de jueces (/alta-jueces) en el dominio actual. */
  protected readonly signupUrl = `${window.location.origin}/alta-jueces`;

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(60)]],
    username: ['', [Validators.required, Validators.pattern(USERNAME_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    void this.load();
    void this.loadRequests();
  }

  protected async copySignupLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.signupUrl);
      this.toast.success('Enlace copiado. Compártelo con los profesores que vayan a ser jueces.');
    } catch {
      this.toast.error('No se ha podido copiar. Copia el enlace manualmente.');
    }
  }

  protected formatDate(date: Date | null): string {
    return date ? this.dateFormat.format(date) : '';
  }

  protected async approve(request: JudgeRequest): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Aprobar juez',
      message: `${request.displayName} (${request.email}) podrá administrar la competición: grupos, pruebas, tiempos y ranking.`,
      confirmLabel: 'Aprobar',
    });
    if (!ok) return;
    this.reviewing.set(request.uid);
    try {
      await this.requestsService.approve(request);
      this.requests.update((list) => (list ?? []).filter((r) => r.uid !== request.uid));
      this.toast.success(`${request.displayName} ya es juez.`);
      void this.load();
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido aprobar la solicitud.'));
    } finally {
      this.reviewing.set(null);
    }
  }

  protected async reject(request: JudgeRequest): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Rechazar solicitud',
      message: `${request.displayName} (${request.email}) no tendrá acceso. Esa cuenta no podrá volver a solicitarlo.`,
      confirmLabel: 'Rechazar',
      danger: true,
    });
    if (!ok) return;
    this.reviewing.set(request.uid);
    try {
      await this.requestsService.reject(request);
      this.requests.update((list) => (list ?? []).filter((r) => r.uid !== request.uid));
      this.toast.success('Solicitud rechazada.');
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido rechazar la solicitud.'));
    } finally {
      this.reviewing.set(null);
    }
  }

  protected refreshRequests(): void {
    void this.loadRequests();
  }

  private async loadRequests(): Promise<void> {
    this.requestsError.set(null);
    try {
      this.requests.set(await this.requestsService.listPending());
    } catch (err) {
      this.requestsError.set(describeError(err, 'No se han podido cargar las solicitudes.'));
    }
  }

  protected openCreate(): void {
    this.form.reset({ displayName: '', username: '', password: generatePassword(10) });
    this.created.set(null);
    this.open.set(true);
  }

  protected async create(): Promise<void> {
    if (this.form.invalid || this.creating()) {
      this.form.markAllAsTouched();
      return;
    }
    const { displayName, username, password } = this.form.getRawValue();
    this.creating.set(true);
    try {
      this.created.set(
        await this.accounts.createAccount({ displayName, username, password, role: 'judge', groupId: null }),
      );
      this.toast.success('Juez creado.');
      void this.load();
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido crear el juez.'));
    } finally {
      this.creating.set(false);
    }
  }

  protected async revoke(judge: UserProfile): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Retirar acceso de juez',
      message: `${judge.displayName} (${judge.username}) dejará de poder administrar la competición.`,
      confirmLabel: 'Retirar acceso',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.users.revokeAccess(judge.uid);
      this.judges.update((list) => (list ?? []).filter((j) => j.uid !== judge.uid));
      this.toast.success('Acceso retirado.');
    } catch (err) {
      this.toast.error(describeError(err));
    }
  }

  private async load(): Promise<void> {
    this.error.set(null);
    try {
      this.judges.set(await this.users.listJudges());
    } catch (err) {
      this.error.set(describeError(err, 'No se han podido cargar los jueces.'));
    }
  }
}
