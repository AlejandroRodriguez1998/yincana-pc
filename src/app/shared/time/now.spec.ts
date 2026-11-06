import { describe, expect, it } from 'vitest';
import { sinceLabel } from './now';

describe('sinceLabel', () => {
  const now = new Date('2026-11-06T10:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms);

  it('muestra "ahora mismo" durante el primer minuto o sin fecha', () => {
    expect(sinceLabel(ago(30_000), now)).toBe('ahora mismo');
    expect(sinceLabel(null, now)).toBe('ahora mismo');
    // Desfase de reloj: fecha ligeramente en el futuro.
    expect(sinceLabel(ago(-5_000), now)).toBe('ahora mismo');
  });

  it('cuenta minutos y horas', () => {
    expect(sinceLabel(ago(3 * 60_000 + 59_000), now)).toBe('hace 3 min');
    expect(sinceLabel(ago(65 * 60_000), now)).toBe('hace 1 h 05 min');
  });
});
