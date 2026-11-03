import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiskService } from '../../core/data/disk.service';
import { describeError } from '../../core/firebase/errors';
import { DiskConfig, formatDiskCode } from '../../core/models';
import { Icon } from '../../shared/components/icon/icon';
import { QrCode } from '../../shared/components/qr-code/qr-code';

/**
 * Tarjetas de sector (QR + código) y tabla FAT (sector → ubicación) para imprimir.
 * Sin menú: pensada para "Imprimir" del navegador en A4.
 */
@Component({
  selector: 'app-disk-print-page',
  imports: [RouterLink, Icon, QrCode],
  template: `
    <header class="toolbar">
      <a class="btn btn-ghost btn-sm" [routerLink]="['/juez/disco', testId()]">
        <app-icon name="chevron-left" [size]="18" /> Volver
      </a>
      <span class="grow"></span>
      <label class="switch-inline small">
        <input type="checkbox" [checked]="withFat()" (change)="withFat.set(!withFat())" /> Incluir FAT
      </label>
      <button type="button" class="btn btn-primary btn-sm" (click)="print()" [disabled]="!config()">
        <app-icon name="printer" [size]="18" /> Imprimir
      </button>
    </header>

    @if (error(); as e) {
      <p class="form-error pad">{{ e }}</p>
    } @else if (!config()) {
      <p class="muted pad">Cargando…</p>
    } @else if (config()!.sectors.length === 0) {
      <p class="muted pad">No hay sectores configurados.</p>
    } @else {
      <section class="cards">
        @for (s of config()!.sectors; track s.code) {
          <article class="sector-card">
            <header>
              <span class="kicker">Sector</span>
              <strong class="label">{{ s.label }}</strong>
            </header>
            <app-qr-code [value]="urlFor(s.code)" [label]="'QR del sector ' + s.label" />
            <p class="code">{{ format(s.code) }}</p>
            <p class="foot">Escanéalo desde la app de la Yincana</p>
          </article>
        }
      </section>

      @if (withFat()) {
        <section class="fat">
          <h1>Tabla de asignación de archivos (FAT)</h1>
          <p>Busca aquí dónde está cada sector del disco.</p>
          <table>
            <thead>
              <tr><th>Sector</th><th>Ubicación</th></tr>
            </thead>
            <tbody>
              @for (s of sortedSectors(); track s.code) {
                <tr>
                  <td class="mono">{{ s.label }}</td>
                  <td>{{ s.location || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: calc(8px + var(--safe-top)) 16px 8px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .switch-inline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pad {
      padding: 16px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
      padding: 16px;
    }
    .sector-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 14px;
      border: 2px dashed #9aa6b5;
      border-radius: 12px;
      background: #fff;
      color: #0f1726;
      break-inside: avoid;
      page-break-inside: avoid;

      header {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .kicker {
        font-size: 0.7rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #5a6577;
      }
      .label {
        font-family: var(--font-mono);
        font-size: 2rem;
        line-height: 1.1;
      }
      app-qr-code {
        width: 100%;
        max-width: 170px;
      }
      .code {
        margin: 0;
        font-family: var(--font-mono);
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .foot {
        margin: 0;
        font-size: 0.7rem;
        color: #5a6577;
        text-align: center;
      }
    }
    .fat {
      padding: 16px;
      background: #fff;
      color: #0f1726;

      h1 {
        font-size: 1.5rem;
        margin: 0 0 4px;
      }
      p {
        margin: 0 0 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 1.1rem;
      }
      th,
      td {
        padding: 8px 10px;
        border: 1px solid #c3ccd9;
        text-align: left;
      }
      td.mono {
        width: 110px;
        font-weight: 700;
      }
    }
    @media print {
      :host {
        background: #fff;
      }
      .toolbar {
        display: none;
      }
      .cards {
        grid-template-columns: repeat(3, 1fr);
        padding: 0;
      }
      .fat {
        break-before: page;
        page-break-before: always;
        padding: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiskPrintPage {
  private readonly disk = inject(DiskService);

  readonly testId = input.required<string>();

  protected readonly config = signal<DiskConfig | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly withFat = signal(true);
  protected readonly format = formatDiskCode;

  protected readonly sortedSectors = computed(() =>
    [...(this.config()?.sectors ?? [])].sort((a, b) => parseInt(a.label, 16) - parseInt(b.label, 16)),
  );

  constructor() {
    effect(() => {
      const testId = this.testId();
      untracked(() => {
        this.disk
          .loadConfig(testId)
          .then((config) => {
            if (config) this.config.set(config);
            else this.error.set('Esta prueba aún no tiene configuración. Guárdala desde el panel de la prueba.');
          })
          .catch((err: unknown) => this.error.set(describeError(err, 'No se ha podido cargar la configuración.')));
      });
    });
  }

  /** El QR abre directamente la prueba en la app con el código del sector. */
  protected urlFor(code: string): string {
    return `${location.origin}/grupo/disco/${this.testId()}?s=${code}`;
  }

  protected print(): void {
    window.print();
  }
}
