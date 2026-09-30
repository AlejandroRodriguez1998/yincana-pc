import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-error-state',
  imports: [Icon],
  template: `
    <div class="form-error" role="alert">
      <app-icon name="alert" [size]="18" />
      <span>{{ message() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorState {
  readonly message = input.required<string>();
}
