/**
 * Sonidos del Simón dice con Web Audio (sin ficheros). Tonos del Simon original:
 * verde G4, rojo E4, amarillo C4, azul G3.
 */
const PAD_FREQUENCIES = [391.995, 329.628, 261.626, 195.998] as const;
const ERROR_FREQUENCY = 110;

export class SimonAudio {
  private context: AudioContext | null = null;
  muted = false;

  /** Debe llamarse desde un gesto del usuario (los navegadores lo exigen). */
  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
    }
    void this.context.resume();
  }

  pad(index: number, durationMs: number): void {
    const frequency = PAD_FREQUENCIES[index];
    if (frequency !== undefined) this.tone(frequency, durationMs, 'triangle', 0.25);
  }

  error(): void {
    this.tone(ERROR_FREQUENCY, 650, 'sawtooth', 0.18);
  }

  success(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => this.tone(f, 160, 'triangle', 0.2), i * 120),
    );
  }

  close(): void {
    void this.context?.close();
    this.context = null;
  }

  private tone(frequency: number, durationMs: number, type: OscillatorType, volume: number): void {
    const ctx = this.context;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const end = now + durationMs / 1000;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    // Envolvente corta para evitar chasquidos.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.setValueAtTime(volume, Math.max(now + 0.015, end - 0.04));
    gain.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(end + 0.02);
  }
}
