import { describe, expect, it } from 'vitest';
import { DiskConfig, diskPhase, normalizeDiskCode, normalizeDiskFile } from '../models';
import { DEFAULT_DISK_QUESTIONS } from './disk-questions';
import { RandomInt, configProblems, planGroupDisk, resizeSectors } from './disk-plan';

/** Generador determinista (LCG) para tests reproducibles. */
function seeded(seed: number): RandomInt {
  let state = seed;
  return (max) => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state % max;
  };
}

function config(overrides: Partial<DiskConfig> = {}): DiskConfig {
  const rand = seeded(1);
  return {
    sectors: resizeSectors([], 10, rand),
    questions: DEFAULT_DISK_QUESTIONS,
    chainLength: 6,
    penaltySeconds: 30,
    fragmentDigits: 4,
    ...overrides,
  };
}

describe('resizeSectors', () => {
  it('crea sectores con etiquetas y códigos únicos', () => {
    const sectors = resizeSectors([], 30, seeded(7));
    expect(new Set(sectors.map((s) => s.label)).size).toBe(30);
    expect(new Set(sectors.map((s) => s.code)).size).toBe(30);
    expect(sectors.every((s) => /^0x[0-9A-F]{2}$/.test(s.label))).toBe(true);
  });

  it('conserva los sectores existentes al ampliar o reducir', () => {
    const base = resizeSectors([], 5, seeded(3));
    const more = resizeSectors(base, 8, seeded(4));
    expect(more.slice(0, 5)).toEqual(base);
    expect(resizeSectors(more, 2, seeded(5))).toEqual(base.slice(0, 2));
  });
});

describe('planGroupDisk', () => {
  it('recorre sectores distintos y encadena los punteros', () => {
    const cfg = config();
    const disk = planGroupDisk(cfg, seeded(42));
    expect(disk.codes).toHaveLength(6);
    expect(new Set(disk.codes).size).toBe(6);
    expect(disk.reveals[0]).toEqual({ index: 0, fragment: null, nextLabel: disk.labels[0] });
    disk.reveals.slice(1).forEach((r, i) => {
      expect(r.fragment).toBe(disk.fragments[i]);
      expect(r.nextLabel).toBe(disk.labels[i + 1] ?? null);
    });
    expect(disk.file).toBe(disk.fragments.join(''));
    expect(disk.file).toMatch(/^\d{24}$/);
  });

  it('la respuesta guardada apunta a la opción correcta tras barajar', () => {
    const cfg = config();
    const disk = planGroupDisk(cfg, seeded(9));
    disk.steps.forEach((step, i) => {
      const original = cfg.questions.find((q) => q.text === step.question)!;
      expect(step.options[disk.answers[i]]).toBe(original.options[original.correct]);
    });
  });
});

describe('configProblems', () => {
  it('avisa si faltan sectores o preguntas', () => {
    expect(configProblems(config())).toEqual([]);
    expect(configProblems(config({ chainLength: 11 }))).toHaveLength(1);
    expect(configProblems(config({ questions: DEFAULT_DISK_QUESTIONS.slice(0, 2) }))).toHaveLength(1);
  });
});

describe('utilidades', () => {
  it('normaliza códigos tecleados o leídos del QR', () => {
    expect(normalizeDiskCode('k7p-q2m')).toBe('K7PQ2M');
    expect(normalizeDiskCode('https://x.web.app/grupo/disco/abc?s=K7PQ2M')).toBe('K7PQ2M');
  });

  it('el archivo solo cuenta dígitos', () => {
    expect(normalizeDiskFile('1234 5678-90')).toBe('1234567890');
  });

  it('calcula la fase de la partida', () => {
    const run = { id: '', testId: '', groupId: '', startedAt: null, found: 0, step: 0, wrong: 0, finishedAt: null };
    expect(diskPhase(run, 3)).toBe('locate');
    expect(diskPhase({ ...run, found: 1 }, 3)).toBe('question');
    expect(diskPhase({ ...run, found: 3, step: 3 }, 3)).toBe('rebuild');
    expect(diskPhase({ ...run, finishedAt: new Date() }, 3)).toBe('done');
  });
});
