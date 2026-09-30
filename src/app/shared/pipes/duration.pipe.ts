import { Pipe, PipeTransform } from '@angular/core';

/** Formatea milisegundos como m:ss.d (o h:mm:ss.d si supera la hora). */
export function formatDuration(ms: number | null | undefined, withTenths = true): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const safe = Math.max(0, Math.floor(ms));
  const tenths = Math.floor((safe % 1000) / 100);
  const totalSeconds = Math.floor(safe / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const ss = String(seconds).padStart(2, '0');
  const tail = withTenths ? `.${tenths}` : '';
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}${tail}`
    : `${minutes}:${ss}${tail}`;
}

/** Interpreta "m:ss", "m:ss.d", "h:mm:ss" o segundos ("75.5"). Devuelve null si no es válido. */
export function parseDuration(text: string): number | null {
  const value = text.trim().replace(',', '.');
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const numbers = parts.map(Number);
  let seconds = 0;
  for (const n of numbers) seconds = seconds * 60 + n;
  if (parts.length > 1 && numbers.slice(1).some((n) => n >= 60)) return null;
  return Math.round(seconds * 1000);
}

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null | undefined, withTenths = true): string {
    return formatDuration(ms, withTenths);
  }
}
