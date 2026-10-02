import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { SIMON_DIFFICULTIES, SIMON_DIFFICULTY_LABELS, SIMON_ROUNDS_MAX, SimonDifficulty } from '../../core/models';
import { Icon } from '../../shared/components/icon/icon';
import { stepsInRound } from './simon-game';
import { PENALTY_OPTIONS, SimonPlaySettings, saveSettings } from './simon-settings';

/** Selector de dificultad, rondas y penalización (se recuerda en el dispositivo). */
@Component({
  selector: 'app-simon-settings-picker',
  imports: [Icon],
  template: `
    @let s = settings();
    <div class="setting">
      <span class="setting-label" id="sp-difficulty">Dificultad</span>
      <div class="seg seg-3" role="radiogroup" aria-labelledby="sp-difficulty">
        @for (d of difficulties; track d) {
          <button type="button" role="radio" [class.on]="s.difficulty === d" [attr.aria-checked]="s.difficulty === d"
                  (click)="update({ difficulty: d })">
            {{ labels[d] }}
          </button>
        }
      </div>
    </div>

    <div class="setting">
      <span class="setting-label" id="sp-rounds">Rondas</span>
      <div class="seg stepper" role="group" aria-labelledby="sp-rounds">
        <button type="button" (click)="update({ rounds: s.rounds - 1 })" [disabled]="s.rounds <= 1" aria-label="Una ronda menos">
          <app-icon name="minus" [size]="18" />
        </button>
        <span class="stepper-value mono" aria-live="polite">{{ s.rounds }}</span>
        <button type="button" (click)="update({ rounds: s.rounds + 1 })" [disabled]="s.rounds >= roundsMax"
                aria-label="Una ronda más">
          <app-icon name="plus" [size]="18" />
        </button>
      </div>
    </div>

    <div class="setting">
      <span class="setting-label" id="sp-penalty">Penalización por fallo</span>
      <div class="seg seg-5" role="radiogroup" aria-labelledby="sp-penalty">
        @for (p of penalties; track p) {
          <button type="button" role="radio" [class.on]="s.penaltySeconds === p" [attr.aria-checked]="s.penaltySeconds === p"
                  (click)="update({ penaltySeconds: p })">
            {{ p === 0 ? 'Sin' : '+' + p + ' s' }}
          </button>
        }
      </div>
    </div>

    <p class="summary small">
      De {{ firstSteps() }} a {{ lastSteps() }} pasos, cada vez más rápido.
      @if (s.penaltySeconds > 0) {
        Cada fallo suma {{ s.penaltySeconds }} s y se repite la ronda.
      } @else {
        Los fallos no penalizan: solo se repite la ronda.
      }
    </p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .setting {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .setting-label {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .seg {
      display: grid;
      gap: 4px;
      padding: 4px;
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 1px solid var(--border);
      button {
        min-height: 42px;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: var(--text-muted);
        font-weight: 700;
        cursor: pointer;
        &:hover:not(:disabled):not(.on) {
          color: var(--text);
        }
        &.on {
          background: var(--primary);
          color: var(--primary-contrast);
        }
        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      }
    }
    .seg-3 {
      grid-template-columns: repeat(3, 1fr);
    }
    .seg-5 {
      grid-template-columns: repeat(5, 1fr);
    }
    .stepper {
      grid-template-columns: 52px 1fr 52px;
      align-items: center;
      button {
        display: grid;
        place-items: center;
        color: var(--text);
      }
    }
    .stepper-value {
      font-size: 1.2rem;
      font-weight: 800;
      text-align: center;
    }
    .summary {
      padding: 10px 12px;
      border-radius: var(--radius);
      background: var(--primary-soft);
      color: var(--text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimonSettingsPicker {
  readonly settings = model.required<SimonPlaySettings>();

  protected readonly difficulties = SIMON_DIFFICULTIES;
  protected readonly labels = SIMON_DIFFICULTY_LABELS;
  protected readonly penalties = PENALTY_OPTIONS;
  protected readonly roundsMax = SIMON_ROUNDS_MAX;
  protected readonly firstSteps = computed(() => stepsInRound(1, this.settings().difficulty));
  protected readonly lastSteps = computed(() =>
    stepsInRound(this.settings().rounds, this.settings().difficulty),
  );

  protected update(change: Partial<SimonPlaySettings>): void {
    const next = { ...this.settings(), ...change };
    const rounds = Math.min(SIMON_ROUNDS_MAX, Math.max(1, next.rounds));
    const value: SimonPlaySettings = { ...next, rounds, difficulty: next.difficulty as SimonDifficulty };
    this.settings.set(value);
    saveSettings(value);
  }
}
