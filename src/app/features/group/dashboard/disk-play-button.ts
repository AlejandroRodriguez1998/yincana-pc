import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Unsubscribe, onSnapshot } from 'firebase/firestore';
import { DiskService } from '../../../core/data/disk.service';
import { Icon } from '../../../shared/components/icon/icon';

/**
 * Botón "Jugar" de una prueba de disco en Mi grupo. Solo aparece cuando un
 * juez ha dado acceso al grupo (o ya tiene la partida empezada), para que
 * nadie la empiece por error.
 */
@Component({
  selector: 'app-disk-play-button',
  imports: [RouterLink, Icon],
  template: `
    @if (visible()) {
      <a class="btn btn-primary btn-block" [routerLink]="['/grupo/disco', testId()]">
        <app-icon name="disk" [size]="18" /> {{ started() ? 'Continuar' : 'Jugar' }}
      </a>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    a {
      margin-top: 10px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiskPlayButton {
  private readonly disk = inject(DiskService);

  readonly testId = input.required<string>();
  readonly groupId = input.required<string>();

  private readonly unlocked = signal(false);
  protected readonly started = signal(false);
  protected readonly visible = computed(() => this.unlocked() || this.started());

  constructor() {
    effect((onCleanup) => {
      const testId = this.testId();
      const groupId = this.groupId();
      const subs: Unsubscribe[] = [];
      untracked(() => {
        if (!groupId) return;
        // Si falla la lectura, simplemente no se muestra el botón.
        subs.push(
          onSnapshot(
            this.disk.infoRef(testId, groupId),
            (s) => this.unlocked.set(s.get('unlocked') === true),
            () => this.unlocked.set(false),
          ),
          onSnapshot(
            this.disk.runRef(testId, groupId),
            (s) => this.started.set(s.exists()),
            () => this.started.set(false),
          ),
        );
      });
      onCleanup(() => subs.forEach((u) => u()));
    });
  }
}
