import { describe, expect, it } from 'vitest';
import { groupBadge } from './group-badge';

describe('groupBadge', () => {
  it('omite el prefijo genérico', () => {
    expect(groupBadge('Grupo A')).toBe('A');
    expect(groupBadge('grupo 12')).toBe('12');
  });

  it('usa las iniciales de nombres compuestos', () => {
    expect(groupBadge('Los Transistores')).toBe('LT');
  });

  it('acorta nombres de una palabra', () => {
    expect(groupBadge('Overclock')).toBe('OVE');
  });
});
