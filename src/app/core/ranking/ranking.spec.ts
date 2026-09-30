import { describe, expect, it } from 'vitest';
import { PublicStandings, Standings, computeTotalTime } from '../models';
import { computePublicRanking, computeRanking, toPublicStanding } from './ranking';

const r = (totalMs: number, penaltyMs = 0) => ({ totalMs, penaltyMs });
const active = new Set(['t1', 't2']);

describe('computeTotalTime', () => {
  it('suma la penalización al tiempo cronometrado', () => {
    expect(computeTotalTime(90_000, 30_000)).toBe(120_000);
  });
});

describe('computeRanking', () => {
  it('ordena por pruebas completadas y luego por menor tiempo, manteniendo empates', () => {
    const standings: Standings = {
      groups: {
        rapidoIncompleto: { name: 'A', active: true, results: { t1: r(10_000) } },
        lento: { name: 'B', active: true, results: { t1: r(100_000), t2: r(100_000) } },
        rapido: { name: 'C', active: true, results: { t1: r(50_000), t2: r(60_000, 10_000) } },
        empate: { name: 'D', active: true, results: { t1: r(60_000), t2: r(50_000) } },
        nada: { name: 'E', active: true, results: {} },
      },
    };

    const ranking = computeRanking(standings, active);

    expect(ranking.map((e) => [e.name, e.position, e.tied])).toEqual([
      ['C', 1, true],
      ['D', 1, true],
      ['B', 3, false],
      ['A', 4, false],
      ['E', 5, false],
    ]);
    expect(ranking[0]?.totalMs).toBe(110_000);
  });

  it('excluye grupos inactivos y pruebas inactivas', () => {
    const standings: Standings = {
      groups: {
        a: { name: 'A', active: true, results: { t1: r(5_000), off: r(999_000) } },
        z: { name: 'Z', active: false, results: { t1: r(1_000) } },
      },
    };

    const ranking = computeRanking(standings, active);

    expect(ranking).toHaveLength(1);
    expect(ranking[0]?.totalMs).toBe(5_000);
    expect(ranking[0]?.completed).toBe(1);
  });
});

describe('ranking público', () => {
  it('coincide con el ranking completo sin exponer el desglose', () => {
    const standings: Standings = {
      groups: {
        a: { name: 'A', active: true, results: { t1: r(5_000), t2: r(7_000), off: r(1) } },
        b: { name: 'B', active: true, results: { t1: r(4_000) } },
      },
    };
    const pub: PublicStandings = {
      groups: Object.fromEntries(
        Object.entries(standings.groups).map(([id, g]) => [id, toPublicStanding(g, active)]),
      ),
    };

    const full = computeRanking(standings, active);
    const publicRanking = computePublicRanking(pub);

    expect(publicRanking.map((e) => [e.groupId, e.position, e.totalMs, e.completed])).toEqual(
      full.map((e) => [e.groupId, e.position, e.totalMs, e.completed]),
    );
    expect(publicRanking.every((e) => Object.keys(e.results).length === 0)).toBe(true);
  });
});
