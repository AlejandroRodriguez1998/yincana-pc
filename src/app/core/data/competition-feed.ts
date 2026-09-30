import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { liveDoc, liveDocWhen, liveQuery } from '../firebase/live';
import { GROUP_REVEAL_DELAY_MS } from '../models';
import { computePublicRanking, computeRanking } from '../ranking/ranking';
import { toPublicStandings, toSettings, toStandings, toTest } from './mappers';
import {
  COLLECTIONS,
  PUBLIC_STANDINGS_DOC_ID,
  SETTINGS_DOC_ID,
  STANDINGS_DOC_ID,
} from './paths';

/**
 * Datos en directo comunes a jueces y grupos: pruebas (M lecturas iniciales)
 * y ajustes de la competición (1 lectura).
 *
 * Los feeds no son singletons: se proveen en el componente contenedor de cada
 * zona, de modo que los listeners se crean una vez por zona y se cancelan al salir.
 */
abstract class BaseFeed {
  protected readonly db = inject(FIRESTORE);

  protected readonly testsLive = liveQuery(
    query(collection(this.db, COLLECTIONS.tests), orderBy('order', 'asc')),
    toTest,
  );
  protected readonly settingsLive = liveDoc(
    doc(this.db, COLLECTIONS.settings, SETTINGS_DOC_ID),
    toSettings,
  );

  /** Todas las pruebas, ordenadas por `order`. */
  readonly tests = this.testsLive.value;
  readonly activeTests = computed(() => this.tests().filter((t) => t.active));
  readonly activeTestIds = computed(() => new Set(this.activeTests().map((t) => t.id)));
  readonly testsById = computed(() => new Map(this.tests().map((t) => [t.id, t])));

  /** Si un juez ha revelado el ranking (por defecto, no). */
  readonly rankingRevealed = computed(() => this.settingsLive.value()?.rankingRevealed === true);
  readonly revealedAt = computed(() => this.settingsLive.value()?.revealedAt ?? null);
}

/** Margen por posibles desfases entre el reloj del móvil y el del servidor. */
const CLOCK_MARGIN_MS = 1_500;

/**
 * Datos en directo de jueces y pantalla final: pruebas + desglose completo
 * (standings/current, 1 lectura por actualización). Solo legible por jueces.
 */
@Injectable()
export class CompetitionFeed extends BaseFeed {
  private readonly standingsLive = liveDoc(
    doc(this.db, COLLECTIONS.standings, STANDINGS_DOC_ID),
    toStandings,
  );

  readonly standings = this.standingsLive.value;
  readonly ranking = computed(() => computeRanking(this.standings(), this.activeTestIds()));

  readonly loading = computed(
    () => this.testsLive.loading() || this.standingsLive.loading() || this.settingsLive.loading(),
  );
  readonly error = computed(
    () => this.testsLive.error() ?? this.standingsLive.error() ?? this.settingsLive.error(),
  );
}

/**
 * Datos en directo de los grupos: pruebas + totales públicos (standings/public).
 * El listener del ranking solo se abre cuando un juez lo ha revelado: antes,
 * las reglas de Firestore deniegan esa lectura a los grupos.
 */
@Injectable()
export class PublicRankingFeed extends BaseFeed {
  private readonly clock = signal(Date.now());
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * El grupo ve el ranking cuando está revelado Y ha terminado la animación
   * del podio (GROUP_REVEAL_DELAY_MS después de pulsar "Revelar").
   */
  readonly groupsCanSee = computed(() => {
    const at = this.revealedAt();
    return (
      this.rankingRevealed() &&
      !!at &&
      this.clock() >= at.getTime() + GROUP_REVEAL_DELAY_MS + CLOCK_MARGIN_MS
    );
  });
  /** Revelado, pero aún en la animación: los grupos esperan sin spoiler. */
  readonly revealInProgress = computed(() => this.rankingRevealed() && !this.groupsCanSee());

  private readonly standingsLive = liveDocWhen(
    this.groupsCanSee,
    doc(this.db, COLLECTIONS.standings, PUBLIC_STANDINGS_DOC_ID),
    toPublicStandings,
  );

  /** Vacío mientras el ranking no sea visible para los grupos. */
  readonly ranking = computed(() =>
    this.groupsCanSee() ? computePublicRanking(this.standingsLive.value()) : [],
  );

  constructor() {
    super();
    // Programa el momento exacto en que el ranking pasa a ser visible.
    effect(() => {
      const at = this.revealedAt();
      const revealed = this.rankingRevealed();
      untracked(() => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.clock.set(Date.now());
        if (!revealed || !at) return;
        const wait = at.getTime() + GROUP_REVEAL_DELAY_MS + CLOCK_MARGIN_MS - Date.now();
        if (wait > 0) this.timer = setTimeout(() => this.clock.set(Date.now()), wait + 50);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  readonly loading = computed(
    () => this.testsLive.loading() || this.settingsLive.loading() || this.standingsLive.loading(),
  );
  readonly error = computed(
    () => this.testsLive.error() ?? this.settingsLive.error() ?? this.standingsLive.error(),
  );
}
