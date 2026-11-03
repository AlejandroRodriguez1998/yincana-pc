// Pantalla de carga definida en index.html (se pinta antes de que arranque Angular).

/** Tiempo mínimo visible, para que la animación de entrada se llegue a ver entera. */
const MIN_VISIBLE_MS = 1400;
const FADE_MS = 500;

let hidden = false;

/** Desvanece y elimina la pantalla de carga. Idempotente. */
export function hideSplash(): void {
  if (hidden) return;
  hidden = true;
  const el = document.getElementById('splash');
  if (!el) return;

  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
  setTimeout(() => {
    requestAnimationFrame(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), FADE_MS + 50);
    });
  }, wait);
}
