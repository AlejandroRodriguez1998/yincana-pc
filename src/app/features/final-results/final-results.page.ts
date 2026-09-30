import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CompetitionFeed } from '../../core/data/competition-feed';
import { FinalResults } from './final-results';

/**
 * Ruta /resultados: pantalla final a pantalla completa (sin menú), para proyector.
 * Aloja el listener de datos mientras la pantalla está abierta.
 */
@Component({
  selector: 'app-final-results-page',
  imports: [FinalResults],
  providers: [CompetitionFeed],
  template: `<app-final-results mode="fullscreen" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalResultsPage {}
