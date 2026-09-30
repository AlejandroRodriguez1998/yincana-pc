import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../icon/icon';

/** Muestra una sola vez las credenciales recién creadas, con opción de copiarlas. */
@Component({
  selector: 'app-credentials-card',
  imports: [Icon],
  template: `
    <div class="creds" role="group" aria-label="Credenciales creadas">
      <div class="head"><app-icon name="check" [size]="18" /> Acceso creado</div>
      <dl>
        <dt>Usuario</dt>
        <dd class="mono">{{ username() }}</dd>
        <dt>Contraseña</dt>
        <dd class="mono">{{ password() }}</dd>
      </dl>
      <p class="small warn">Anótala ahora: por seguridad no se puede volver a consultar.</p>
      <button type="button" class="btn btn-outline btn-block" (click)="copy()">
        <app-icon name="copy" [size]="18" /> Copiar usuario y contraseña
      </button>
    </div>
  `,
  styles: `
    .creds {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      border-radius: var(--radius-lg);
      background: var(--accent-soft);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--accent);
      font-weight: 700;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
    }
    dt {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    dd {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      word-break: break-all;
    }
    .warn {
      color: var(--text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialsCard {
  private readonly toast = inject(ToastService);
  readonly username = input.required<string>();
  readonly password = input.required<string>();

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`Usuario: ${this.username()}\nContraseña: ${this.password()}`);
      this.toast.success('Copiado al portapapeles.');
    } catch {
      this.toast.error('No se ha podido copiar. Anótalo manualmente.');
    }
  }
}
