import {
  PublicStanding,
  PublicStandings,
  RankingEntry,
  StandingGroup,
  StandingResult,
  Standings,
} from '../models';

type Row = Omit<RankingEntry, 'position' | 'tied'>;

/** Totales de un grupo contando solo las pruebas activas. */
export function summarizeGroup(
  group: StandingGroup,
  activeTestIds: ReadonlySet<string>,
): { totalMs: number; completed: number; results: Record<string, StandingResult> } {
  let totalMs = 0;
  let completed = 0;
  const results: Record<string, StandingResult> = {};
  for (const [testId, result] of Object.entries(group.results)) {
    if (!activeTestIds.has(testId)) continue;
    totalMs += result.totalMs;
    completed += 1;
    results[testId] = result;
  }
  return { totalMs, completed, results };
}

/** Entrada pública (standings/public) derivada del desglose de un grupo. */
export function toPublicStanding(
  group: StandingGroup,
  activeTestIds: ReadonlySet<string>,
): PublicStanding {
  const { totalMs, completed } = summarizeGroup(group, activeTestIds);
  return { name: group.name, active: group.active, totalMs, completed };
}

/**
 * Ordena y asigna posiciones.
 * - Orden: 1) más pruebas completadas, 2) menor tiempo total acumulado.
 * - Si persiste el empate, los grupos comparten posición (1, 1, 3...).
 *   El orden alfabético entre empatados es solo de presentación.
 */
function rank(rows: Row[]): RankingEntry[] {
  rows.sort(
    (a, b) =>
      b.completed - a.completed || a.totalMs - b.totalMs || a.name.localeCompare(b.name, 'es'),
  );
  const sameRank = (a: Row, b: Row) => a.completed === b.completed && a.totalMs === b.totalMs;

  let position = 0;
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const next = rows[index + 1];
    if (!previous || !sameRank(previous, row)) {
      position = index + 1;
    }
    const tied = (!!previous && sameRank(previous, row)) || (!!next && sameRank(next, row));
    return { ...row, position, tied };
  });
}

/** Ranking completo (jueces) a partir del desglose. Solo grupos y pruebas activos. */
export function computeRanking(
  standings: Standings | null,
  activeTestIds: ReadonlySet<string>,
): RankingEntry[] {
  if (!standings) return [];
  return rank(
    Object.entries(standings.groups)
      .filter(([, group]) => group.active)
      .map(([groupId, group]) => ({
        groupId,
        name: group.name,
        ...summarizeGroup(group, activeTestIds),
      })),
  );
}

/** Ranking de los grupos a partir de standings/public (sin desglose por prueba). */
export function computePublicRanking(standings: PublicStandings | null): RankingEntry[] {
  if (!standings) return [];
  return rank(
    Object.entries(standings.groups)
      .filter(([, group]) => group.active)
      .map(([groupId, group]) => ({
        groupId,
        name: group.name,
        totalMs: group.totalMs,
        completed: group.completed,
        results: {},
      })),
  );
}
