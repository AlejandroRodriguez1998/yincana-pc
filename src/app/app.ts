import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, untracked } from '@angular/core';
import { NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { hideSplash } from './core/ui/splash';
import { ThemeService } from './core/ui/theme.service';
import { ConfirmHost } from './shared/components/confirm-host/confirm-host';
import { ToastHost } from './shared/components/toast-host/toast-host';
import { UpdateBanner } from './shared/components/update-banner/update-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, ConfirmHost, UpdateBanner],
  template: `
    <div class="status-bar" aria-hidden="true"></div>
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

    // Quita la pantalla de carga cuando termina la primera navegación: para entonces
    // los guards ya han resuelto la sesión y la página de destino está pintada.
    const firstNav = this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd || e instanceof NavigationError),
        take(1),
      )
      .subscribe(() => hideSplash());
    inject(DestroyRef).onDestroy(() => firstNav.unsubscribe());

    // Si la sesión se cierra o un juez retira el acceso mientras se usa la app,
    // se vuelve al login (las reglas de Firestore ya estarían denegando lecturas).
    effect(() => {
      const status = this.auth.status();
      untracked(() => {
        const url = this.router.url;
        const onPublicPage =
          url.startsWith('/login') || url.startsWith('/alta-jueces') || url === '/' || url.startsWith('/?');
        if ((status === 'signedOut' || status === 'noProfile') && !onPublicPage && this.router.navigated) {
          void this.router.navigateByUrl('/login');
        }
      });
    });
  }
}
