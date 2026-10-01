import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PwaService } from '../../core/pwa/pwa.service';
import { ThemeService } from '../../core/ui/theme.service';
import { Icon } from '../../shared/components/icon/icon';
import { IconName } from '../../shared/components/icon/icons';

interface Feature {
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
}

/** Página de inicio pública (sin sesión). No consulta Firestore. */
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, Icon],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  protected readonly theme = inject(ThemeService);
  protected readonly pwa = inject(PwaService);

  protected readonly features: readonly Feature[] = [
    {
      icon: 'cpu',
      title: 'Pruebas de hardware',
      text: 'Montaje, componentes, cableado, arranque… Cada grupo supera las pruebas en el orden que quiera.',
    },
    {
      icon: 'timer',
      title: 'Contra el reloj',
      text: 'Los jueces cronometran cada prueba. Las penalizaciones suman tiempo.',
    },
    {
      icon: 'trophy',
      title: 'Podio sorpresa',
      text: 'Gana quien completa todo en menos tiempo. El ranking se revela al final.',
    },
  ];
}
