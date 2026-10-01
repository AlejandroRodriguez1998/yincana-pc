import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/ui/theme.service';
import { ConfirmHost } from './shared/components/confirm-host/confirm-host';
import { ToastHost } from './shared/components/toast-host/toast-host';
import { UpdateBanner } from './shared/components/update-banner/update-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, ConfirmHost, UpdateBanner],
  template: `
    <router-outlet />
    <app-toast-host />
    <app-confirm-host />
    <app-update-banner />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    inject(ThemeService);

    // Si la sesión se cierra o un juez retira el acceso mientras se usa la app,
    // se vuelve al login (las reglas de Firestore ya estarían denegando lecturas).
    effect(() => {
      const status = this.auth.status();
      untracked(() => {
        const url = this.router.url;
        const onPublicPage = url.startsWith('/login') || url === '/' || url.startsWith('/?');
        if ((status === 'signedOut' || status === 'noProfile') && !onPublicPage && this.router.navigated) {
          void this.router.navigateByUrl('/login');
        }
      });
    });
  }
}
