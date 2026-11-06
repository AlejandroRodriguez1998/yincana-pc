import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import qrcode from 'qrcode-generator';

/** Zona blanca alrededor: el estándar QR pide 4 módulos. */
const MARGIN = 4;

/** Código QR como SVG (un único path): nítido al imprimir y sin innerHTML. */
@Component({
  selector: 'app-qr-code',
  template: `
    <svg [attr.viewBox]="'0 0 ' + qr().size + ' ' + qr().size" shape-rendering="crispEdges"
         role="img" [attr.aria-label]="label() || 'Código QR'">
      <rect [attr.width]="qr().size" [attr.height]="qr().size" fill="#fff" />
      <path [attr.d]="qr().path" fill="#000" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      line-height: 0;
    }
    svg {
      width: 100%;
      height: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly label = input('');

  protected readonly qr = computed(() => {
    const code = qrcode(0, 'M');
    code.addData(this.value());
    code.make();
    const count = code.getModuleCount();
    let path = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (code.isDark(row, col)) path += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`;
      }
    }
    return { size: count + MARGIN * 2, path };
  });
}
