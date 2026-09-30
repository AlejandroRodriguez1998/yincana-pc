/** Valor de un <input>/<select>/<textarea> a partir de su evento, sin recurrir a $any. */
export function eventValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
    ? target.value
    : '';
}
