import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestsService } from '../../../core/data/tests.service';
import { describeError } from '../../../core/firebase/errors';
import { TEST_DESCRIPTION_MAX, TEST_NAME_MAX, Test } from '../../../core/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Sheet } from '../../../shared/components/sheet/sheet';
import { JudgeStore } from '../judge.store';

@Component({
  selector: 'app-tests-page',
  imports: [ReactiveFormsModule, Icon, Sheet, EmptyState, ErrorState],
  templateUrl: './tests.page.html',
  styleUrl: './tests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestsPage {
  protected readonly store = inject(JudgeStore);
  private readonly testsService = inject(TestsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly limits = {
    name: TEST_NAME_MAX,
    description: TEST_DESCRIPTION_MAX,
  };

  /** null = cerrado; 'new' = crear; Test = editar. */
  protected readonly editing = signal<Test | 'new' | null>(null);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(TEST_NAME_MAX)]],
    description: ['', [Validators.maxLength(TEST_DESCRIPTION_MAX)]],
    order: [1, [Validators.required, Validators.min(0), Validators.max(9999)]],
    active: [true],
  });

  protected openCreate(): void {
    const tests = this.store.feed.tests();
    const nextOrder = tests.reduce((max, t) => Math.max(max, t.order), 0) + 1;
    this.form.reset({ name: '', description: '', order: nextOrder, active: true });
    this.editing.set('new');
  }

  protected openEdit(test: Test): void {
    this.form.reset({
      name: test.name,
      description: test.description,
      order: test.order,
      active: test.active,
    });
    this.editing.set(test);
  }

  protected async save(): Promise<void> {
    const target = this.editing();
    if (!target || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    try {
      if (target === 'new') {
        await this.testsService.create(value);
        this.toast.success(`Prueba "${value.name.trim()}" creada.`);
      } else {
        await this.testsService.update(target.id, value, this.store.feed.tests());
        this.toast.success('Prueba guardada.');
      }
      this.editing.set(null);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido guardar la prueba.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleActive(test: Test): Promise<void> {
    this.busyId.set(test.id);
    try {
      await this.testsService.setActive(test, !test.active, this.store.feed.tests());
      this.toast.success(test.active ? `"${test.name}" desactivada.` : `"${test.name}" activada.`);
    } catch (err) {
      this.toast.error(describeError(err));
    } finally {
      this.busyId.set(null);
    }
  }

  protected async move(index: number, direction: -1 | 1): Promise<void> {
    const tests = this.store.feed.tests();
    const a = tests[index];
    const b = tests[index + direction];
    if (!a || !b) return;
    this.busyId.set(a.id);
    try {
      await this.testsService.swapOrder(a, b);
    } catch (err) {
      this.toast.error(describeError(err));
    } finally {
      this.busyId.set(null);
    }
  }

  protected async remove(test: Test): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Eliminar "${test.name}"`,
      message:
        'Se eliminarán la prueba y todos sus tiempos registrados, y el ranking se recalculará. No se puede deshacer.\n\n' +
        'Si solo quieres sacarla de la competición, desactívala.',
      confirmLabel: 'Eliminar prueba',
      danger: true,
    });
    if (!ok) return;
    this.saving.set(true);
    try {
      const removed = await this.testsService.delete(test, this.store.feed.tests());
      this.editing.set(null);
      this.toast.success(`Prueba eliminada (${removed} resultados borrados).`);
    } catch (err) {
      this.toast.error(describeError(err, 'No se ha podido eliminar la prueba.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected editingTest(): Test | null {
    const target = this.editing();
    return target && target !== 'new' ? target : null;
  }
}
