import { Injectable, computed, inject } from '@angular/core';
import { collection } from 'firebase/firestore';
import { CompetitionFeed } from '../../core/data/competition-feed';
import { toGroup } from '../../core/data/mappers';
import { COLLECTIONS } from '../../core/data/paths';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { liveQuery } from '../../core/firebase/live';
import { Group, StandingResult } from '../../core/models';

/**
 * Datos en directo de la zona de jueces. Se provee en JudgeShell, así que todas
 * las páginas del juez comparten los mismos 3 listeners (grupos, pruebas y
 * resumen), que se cancelan al salir de la zona.
 *
 * Coste: N grupos + M pruebas + 1 lectura al entrar; después, solo cambios.
 * El estado "registrado / pendiente" sale de standings, sin leer `scores`.
 */
@Injectable()
export class JudgeStore {
  private readonly db = inject(FIRESTORE);
  readonly feed = inject(CompetitionFeed);

  private readonly groupsLive = liveQuery(collection(this.db, COLLECTIONS.groups), toGroup);

  readonly groups = computed<readonly Group[]>(() =>
    [...this.groupsLive.value()].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { numeric: true }),
    ),
  );
  readonly activeGroups = computed(() => this.groups().filter((g) => g.active));
  readonly groupsById = computed(() => new Map(this.groups().map((g) => [g.id, g])));

  readonly loading = computed(() => this.feed.loading() || this.groupsLive.loading());
  readonly error = computed(() => this.feed.error() ?? this.groupsLive.error());

  /** Pruebas activas completadas por grupo. */
  readonly completedByGroup = computed(() => {
    const standings = this.feed.standings();
    const activeIds = new Set(this.feed.activeTests().map((t) => t.id));
    const result = new Map<string, number>();
    for (const group of this.groups()) {
      const results = standings?.groups[group.id]?.results ?? {};
      result.set(group.id, Object.keys(results).filter((id) => activeIds.has(id)).length);
    }
    return result;
  });

  /** Progreso global: resultados registrados / (grupos activos × pruebas activas). */
  readonly progress = computed(() => {
    const groups = this.activeGroups();
    const tests = this.feed.activeTests();
    const possible = groups.length * tests.length;
    const done = groups.reduce((sum, g) => sum + (this.completedByGroup().get(g.id) ?? 0), 0);
    return { done, possible, percent: possible ? Math.round((done / possible) * 100) : 0 };
  });

  /** Grupos activos que ya tienen resultado en cada prueba activa. */
  readonly progressByTest = computed(() => {
    const standings = this.feed.standings();
    const groups = this.activeGroups();
    return this.feed.activeTests().map((test) => ({
      test,
      done: groups.filter((g) => !!standings?.groups[g.id]?.results[test.id]).length,
      total: groups.length,
    }));
  });

  result(groupId: string, testId: string): StandingResult | null {
    return this.feed.standings()?.groups[groupId]?.results[testId] ?? null;
  }
}
