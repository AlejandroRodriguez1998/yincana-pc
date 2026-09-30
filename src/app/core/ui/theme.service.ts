import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'yincana.theme';

/** Tema claro/oscuro: por defecto sigue al sistema; la elección manual se recuerda. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly _theme = signal<ThemePreference>(this.initial());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
    this.media.addEventListener('change', (event) => {
      if (!this.stored()) this.set(event.matches ? 'dark' : 'light', false);
    });
  }

  toggle(): void {
    this.set(this._theme() === 'dark' ? 'light' : 'dark', true);
  }

  private set(theme: ThemePreference, persist: boolean): void {
    this._theme.set(theme);
    this.apply(theme);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Almacenamiento no disponible (modo privado): no se recuerda la preferencia.
      }
    }
  }

  private apply(theme: ThemePreference): void {
    document.documentElement.dataset['theme'] = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b1119' : '#f3f5f9');
  }

  private stored(): ThemePreference | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  private initial(): ThemePreference {
    return this.stored() ?? (this.media.matches ? 'dark' : 'light');
  }
}
