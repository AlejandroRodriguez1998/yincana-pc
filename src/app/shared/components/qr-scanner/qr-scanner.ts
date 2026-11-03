import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** API nativa (Chrome/Android). En iOS/Safari no existe y se usa jsQR. */
interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?(): Promise<string[]>;
}

type Decoder = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => Promise<string | null>;

/** Lector nativo, solo si existe y declara soportar QR (en iOS/Safari no existe). */
async function nativeDecoder(): Promise<Decoder | null> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Native) return null;
  try {
    const formats = (await Native.getSupportedFormats?.()) ?? ['qr_code'];
    if (!formats.includes('qr_code')) return null;
    const detector = new Native({ formats: ['qr_code'] });
    return async (canvas) => (await detector.detect(canvas))[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

/**
 * Nativo y jsQR combinados: si el nativo no encuentra nada (o falla) en un
 * fotograma, lo intenta jsQR. Así un BarcodeDetector defectuoso no deja el
 * lector "mudo".
 */
async function createDecoder(): Promise<Decoder> {
  const [native, { default: jsQR }] = await Promise.all([nativeDecoder(), import('jsqr')]);
  const fallback: Decoder = async (canvas, ctx) => {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  };
  if (!native) return fallback;
  return async (canvas, ctx) => {
    try {
      const text = await native(canvas, ctx);
      if (text) return text;
    } catch {
      // Se intenta con jsQR.
    }
    return fallback(canvas, ctx);
  };
}

/** Lado del recorte que se analiza (px): la zona central, a buena resolución. */
const CROP_SIZE = 720;

/** Lector de QR con la cámara trasera. Emite el texto del primer código leído. */
@Component({
  selector: 'app-qr-scanner',
  template: `
    <div class="frame">
      <video #video playsinline muted></video>
      <span class="aim" aria-hidden="true"></span>
      @if (status() === 'starting') {
        <p class="msg">Abriendo la cámara…</p>
      } @else if (status() === 'error') {
        <p class="msg">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .frame {
      position: relative;
      aspect-ratio: 1;
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: #000;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .aim {
      position: absolute;
      inset: 10%;
      border: 3px solid rgba(255, 255, 255, 0.85);
      border-radius: 18px;
      box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.35);
    }
    .msg {
      position: absolute;
      inset: auto 12px 12px;
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--radius);
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      text-align: center;
      font-size: 0.9rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrScanner {
  readonly scanned = output<string>();

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly status = signal<'starting' | 'scanning' | 'error'>('starting');
  protected readonly error = signal('');

  private stream: MediaStream | null = null;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    afterNextRender(() => void this.start());
  }

  private async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail('Este navegador no permite usar la cámara. Escribe el código de la tarjeta.');
      return;
    }
    try {
      const [stream, decode] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          // Sin resolución "ideal" muchos móviles dan 640×480 y el QR queda en pocos píxeles.
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        }),
        createDecoder(),
      ]);
      if (this.stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const video = this.video().nativeElement;
      video.srcObject = stream;
      await video.play();
      this.status.set('scanning');
      this.loop(video, decode);
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError';
      this.fail(
        denied
          ? 'Sin permiso para usar la cámara. Actívalo en el navegador o escribe el código de la tarjeta.'
          : 'No se ha podido abrir la cámara. Escribe el código de la tarjeta.',
      );
    }
  }

  private loop(video: HTMLVideoElement, decode: Decoder): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return this.fail('No se puede leer la imagen de la cámara.');

    const tick = async () => {
      if (this.stopped) return;
      if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
        // Se analiza el cuadrado central (lo que se ve en el visor), sin apenas
        // reducirlo: más detalle que la imagen entera escalada y más rápido.
        const side = Math.min(video.videoWidth, video.videoHeight) * 0.85;
        const sx = (video.videoWidth - side) / 2;
        const sy = (video.videoHeight - side) / 2;
        const size = Math.round(Math.min(side, CROP_SIZE));
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
        try {
          const text = await decode(canvas, ctx);
          if (text && !this.stopped) {
            navigator.vibrate?.(60);
            this.scanned.emit(text);
            this.stop();
            return;
          }
        } catch {
          // Fotograma ilegible: se sigue intentando.
        }
      }
      this.timer = setTimeout(() => void tick(), 100);
    };
    void tick();
  }

  private fail(message: string): void {
    this.error.set(message);
    this.status.set('error');
  }

  private stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
