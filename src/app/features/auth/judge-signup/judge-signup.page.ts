import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { JudgeRequestsService } from '../../../core/data/judge-requests.service';
import { describeError } from '../../../core/firebase/errors';
import { JUDGE_NAME_MAX, JUDGE_PASSWORD_MIN } from '../../../core/models';
import { ThemeService } from '../../../core/ui/theme.service';
import { Icon } from '../../../shared/components/icon/icon';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * /alta-jueces: registro de profesores como jueces, pendiente de aprobación.
 * No hay ningún enlace a esta ruta: se comparte a mano.
 */
@Component({
  selector: 'app-judge-signup-page',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './judge-signup.page.html',
  styleUrl: '../login/login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JudgeSignupPage {
  private readonly requests = inject(JudgeRequestsService);
  protected readonly theme = inject(ThemeService);

  protected readonly nameMax = JUDGE_NAME_MAX;
  protected readonly passwordMin = JUDGE_PASSWORD_MIN;
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      displayName: ['', [Validators.required, Validators.maxLength(JUDGE_NAME_MAX)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(JUDGE_PASSWORD_MIN)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { displayName, email, password } = this.form.getRawValue();
    try {
      await this.requests.submit({ displayName, email, password });
      this.sent.set(true);
    } catch (err) {
      this.error.set(this.messageFor(err));
    } finally {
      this.submitting.set(false);
    }
  }

  private messageFor(err: unknown): string {
    if (err instanceof FirebaseError) {
      if (err.code === 'auth/email-already-in-use') {
        return 'Ese email ya está registrado. Si ya enviaste la solicitud, espera a que un juez la apruebe.';
      }
      if (err.code === 'auth/invalid-email') return 'El email no es válido.';
    }
    return describeError(err, 'No se ha podido enviar la solicitud.');
  }
}
