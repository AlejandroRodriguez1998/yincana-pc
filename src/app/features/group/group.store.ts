import { Injectable, computed, inject } from '@angular/core';
import { collection, doc, query, where } from 'firebase/firestore';
import { AuthService } from '../../core/auth/auth.service';
import { PublicRankingFeed } from '../../core/data/competition-feed';
import { toGroup, toScore } from '../../core/data/mappers';
import { COLLECTIONS } from '../../core/data/paths';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { liveDoc, liveQuery } from '../../core/firebase/live';
import { Score, Test } from '../../core/models';

export interface TestCard {
  readonly test: Test;
  readonly score: Score | null;
}

/**
 * Datos en directo de la zona de un grupo. Solo consulta información propia
 * (su documento y sus resultados) más los totales públicos del ranking.
 * Las reglas de Firestore impiden leer resultados de otros grupos.
 */
@Injectable()
export class GroupStore {
  private readonly db = inject(FIRESTORE);
  readonly feed = inject(PublicRankingFeed);
  /** El guard garantiza un perfil de grupo al crear la zona. */
  readonly groupId = inject(AuthService).profile()?.groupId ?? '';

  readonly group = liveDoc(doc(this.db, COLLECTIONS.groups, this.groupId || '_'), toGroup);
  readonly scores = liveQuery(
    query(collection(this.db, COLLECTIONS.scores), where('groupId', '==', this.groupId)),
    toScore,
  );

  readonly loading = computed(() => this.feed.loading() || this.group.loading() || this.scores.loading());
  readonly error = computed(() => this.feed.error() ?? this.group.error() ?? this.scores.error());

  /**
   * Si el grupo puede ver su posición y el ranking general: cuando un juez lo
   * ha revelado y ya ha terminado la animación del podio.
   */
  readonly revealed = this.feed.groupsCanSee;
  /** Un juez ha pulsado "Revelar" y el podio se está desvelando. */
  readonly revealing = this.feed.revealInProgress;
  /** Entrada del grupo en el ranking; null mientras esté oculto. */
  readonly entry = computed(() => this.feed.ranking().find((e) => e.groupId === this.groupId) ?? null);

  readonly cards = computed<readonly TestCard[]>(() => {
    const byTest = new Map(this.scores.value().map((s) => [s.testId, s]));
    return this.feed.activeTests().map((test) => ({ test, score: byTest.get(test.id) ?? null }));
  });
  readonly done = computed(() => this.cards().filter((c) => c.score));
  /** Tiempo total propio (pruebas activas), calculado de sus resultados: no depende del ranking. */
  readonly totalMs = computed(() =>
    this.done().reduce((sum, c) => sum + (c.score?.totalMs ?? 0), 0),
  );
  readonly pending = computed(() => this.cards().filter((c) => !c.score));
  readonly progress = computed(() => {
    const total = this.cards().length;
    return total ? Math.round((this.done().length / total) * 100) : 0;
  });
}
