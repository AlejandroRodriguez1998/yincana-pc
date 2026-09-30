import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Evento no estándar (Chrome/Edge/Android) para ofrecer la instalación. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInstallPrompt(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof Reflect.get(event, 'prompt') === 'function';
}

/** Cada cuánto se comprueba si hay una versión nueva desplegada. */
const UPDATE_CHECK_MS = 15 * 60 * 1000;

/**
 * Funciones de PWA:
 * - Aviso de nueva versión (no recarga sola para no interrumpir a un juez
 *   a mitad de un cronómetro: el usuario decide cuándo).
 * - Botón de instalación cuando el navegador lo permite (Android/Chrome/Edge).
 *   En iOS se instala desde "Compartir → Añadir a pantalla de inicio".
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly updates = inject(SwUpdate);
  private installEvent: BeforeInstallPromptEvent | null = null;

  private readonly _updateReady = signal(false);
  private readonly _canInstall = signal(false);
  readonly updateReady = this._updateReady.asReadonly();
  readonly canInstall = this._canInstall.asReadonly();
  /** true si la app ya se está ejecutando instalada (ventana propia). */
  readonly isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  constructor() {
    const destroyRef = inject(DestroyRef);

    const onPrompt = (event: Event) => {
      if (!isInstallPrompt(event)) return;
      event.preventDefault();
      this.installEvent = event;
      this._canInstall.set(true);
    };
    const onInstalled = () => {
      this.installEvent = null;
      this._canInstall.set(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    });

    if (!this.updates.isEnabled) return;

    const sub = this.updates.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this._updateReady.set(true));
    const unrecoverable = this.updates.unrecoverable.subscribe(() => window.location.reload());
    const interval = setInterval(() => void this.updates.checkForUpdate().catch(() => false), UPDATE_CHECK_MS);
    destroyRef.onDestroy(() => {
      sub.unsubscribe();
      unrecoverable.unsubscribe();
      clearInterval(interval);
    });
  }

  async applyUpdate(): Promise<void> {
    try {
      await this.updates.activateUpdate();
    } finally {
      window.location.reload();
    }
  }

  dismissUpdate(): void {
    this._updateReady.set(false);
  }

  async install(): Promise<void> {
    const event = this.installEvent;
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    this.installEvent = null;
    this._canInstall.set(false);
  }
}
