import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { JudgeRequestsService } from '../../../core/data/judge-requests.service';
import { describeError } from '../../../core/firebase/errors';
import { PwaService } from '../../../core/pwa/pwa.service';
import { ThemeService } from '../../../core/ui/theme.service';
import { Icon } from '../../../shared/components/icon/icon';

const NO_PROFILE_MESSAGE =
  'Tu cuenta existe pero no tiene acceso a la yincana. Pide a un juez que revise tu acceso.';
const PENDING_MESSAGE =
  'Tu solicitud de alta como juez está pendiente. Podrás entrar cuando un juez la apruebe.';
const REJECTED_MESSAGE = 'Tu solicitud de alta como juez ha sido rechazada.';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly judgeRequests = inject(JudgeRequestsService);
  protected readonly theme = inject(ThemeService);
  protected readonly pwa = inject(PwaService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(
    this.auth.status() === 'noProfile' ? NO_PROFILE_MESSAGE : null,
  );

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    try {
      const status = await this.auth.login(username, password);
      if (status === 'ready') {
        await this.router.navigateByUrl('/');
      } else {
        // Sin perfil: puede ser un juez dado de alta en /alta-jueces aún sin aprobar.
        const uid = this.auth.user()?.uid;
        const request = uid ? await this.judgeRequests.statusOf(uid) : null;
        this.error.set(
          request === 'pending' ? PENDING_MESSAGE : request === 'rejected' ? REJECTED_MESSAGE : NO_PROFILE_MESSAGE,
        );
        await this.auth.signOutOnly();
      }
    } catch (err) {
      this.error.set(describeError(err, 'No se ha podido iniciar sesión.'));
    } finally {
      this.submitting.set(false);
    }
  }
}
