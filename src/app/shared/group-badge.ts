const GENERIC_PREFIXES = new Set(['grupo', 'equipo', 'group', 'team']);

/**
 * Texto corto y distintivo para el avatar de un grupo:
 * "Grupo A" → "A", "Grupo 12" → "12", "Los Transistores" → "LT".
 */
export function groupBadge(name: string): string {
  let words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && GENERIC_PREFIXES.has(words[0]!.toLowerCase())) {
    words = words.slice(1);
  }
  if (words.length <= 1) {
    return (words[0] ?? '?').slice(0, 3).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}
