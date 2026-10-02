import { describe, expect, it } from 'vitest';
import { evaluatePress, flashDurationMs, nextPad, randomPad, stepsInRound } from './simon-game';

describe('evaluatePress', () => {
  const sequence = [0, 2, 1, 3];

  it('detecta un fallo', () => {
    expect(evaluatePress(sequence, 2, false, 1, 3)).toBe('wrong');
  });

  it('avanza dentro de la ronda y la completa en el último paso', () => {
    expect(evaluatePress(sequence, 3, false, 0, 0)).toBe('correct');
    expect(evaluatePress(sequence, 3, false, 2, 1)).toBe('roundComplete');
  });

  it('termina la partida al completar la última ronda', () => {
    expect(evaluatePress(sequence, 4, true, 3, 3)).toBe('gameComplete');
  });
});

describe('nextPad', () => {
  it('nunca pone tres veces seguidas el mismo color', () => {
    // "Azar" que siempre pide repetir: aun así no puede haber un triple.
    const alwaysRepeat = () => 0;
    expect(nextPad([1, 1], alwaysRepeat)).not.toBe(1);
  });

  it('en secuencias largas reparte los cuatro colores y evita rachas', () => {
    const sequence: number[] = [];
    for (let i = 0; i < 400; i++) sequence.push(nextPad(sequence));
    expect(new Set(sequence).size).toBe(4);
    for (let i = 2; i < sequence.length; i++) {
      expect(sequence[i] === sequence[i - 1] && sequence[i] === sequence[i - 2]).toBe(false);
    }
    const repeats = sequence.filter((pad, i) => i > 0 && pad === sequence[i - 1]).length;
    expect(repeats / sequence.length).toBeLessThan(0.25);
  });
});

describe('ritmo y aleatoriedad', () => {
  it('acelera con las rondas sin bajar del mínimo', () => {
    expect(flashDurationMs(1, 'normal')).toBeGreaterThan(flashDurationMs(8, 'normal'));
    expect(flashDurationMs(50, 'normal')).toBe(240);
  });

  it('los niveles cambian pasos iniciales y velocidad', () => {
    expect(stepsInRound(1, 'easy')).toBe(1);
    expect(stepsInRound(1, 'hard')).toBe(3);
    expect(stepsInRound(8, 'hard')).toBe(10);
    expect(flashDurationMs(1, 'hard')).toBeLessThan(flashDurationMs(1, 'easy'));
  });

  it('genera pasos entre 0 y 3', () => {
    for (let i = 0; i < 50; i++) {
      const pad = randomPad();
      expect(pad).toBeGreaterThanOrEqual(0);
      expect(pad).toBeLessThan(4);
    }
  });
});
