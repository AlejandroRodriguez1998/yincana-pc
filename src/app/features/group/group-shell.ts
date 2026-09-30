import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicRankingFeed } from '../../core/data/competition-feed';
import { GroupStore } from './group.store';

/**
 * Contenedor de la zona del grupo: aloja sus listeners. El grupo solo tiene
 * una página (inicio), que incluye el ranking general.
 */
@Component({
  selector: 'app-group-shell',
  imports: [RouterOutlet],
  providers: [PublicRankingFeed, GroupStore],
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupShell {}
