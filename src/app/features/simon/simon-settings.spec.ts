import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAY_SETTINGS, normalizeSettings, settingsQueryParams } from './simon-settings';

describe('normalizeSettings', () => {
  it('lee los ajustes de la URL (texto) y los respeta si son válidos', () => {
    expect(normalizeSettings({ difficulty: 'hard', rounds: '12', penaltySeconds: '5' })).toEqual({
      difficulty: 'hard',
      rounds: 12,
      penaltySeconds: 5,
    });
  });

  it('limita valores fuera de rango y usa valores por defecto si son inválidos', () => {
    expect(normalizeSettings({ difficulty: 'imposible', rounds: '999', penaltySeconds: '-3' })).toEqual({
      difficulty: DEFAULT_PLAY_SETTINGS.difficulty,
      rounds: 30,
      penaltySeconds: 0,
    });
    expect(normalizeSettings({ rounds: 'abc' }).rounds).toBe(DEFAULT_PLAY_SETTINGS.rounds);
  });

  it('ida y vuelta por la URL', () => {
    const settings = { difficulty: 'easy' as const, rounds: 6, penaltySeconds: 15 };
    const params = settingsQueryParams(settings);
    expect(
      normalizeSettings({
        difficulty: params['dificultad'],
        rounds: String(params['rondas']),
        penaltySeconds: String(params['penalizacion']),
      }),
    ).toEqual(settings);
  });
});
