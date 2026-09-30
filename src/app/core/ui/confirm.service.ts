import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** Estilo destructivo (botón rojo). */
  readonly danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  readonly resolve: (confirmed: boolean) => void;
}

/** Diálogo de confirmación basado en promesas, renderizado por ConfirmHost. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _request = signal<ConfirmRequest | null>(null);
  readonly request = this._request.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this._request()?.resolve(false);
    return new Promise((resolve) => {
      this._request.set({
        ...options,
        resolve: (confirmed) => {
          this._request.set(null);
          resolve(confirmed);
        },
      });
    });
  }
}
