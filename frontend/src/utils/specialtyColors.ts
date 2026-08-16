export const SPECIALTY_COLOR_TOKENS = [
  'var(--appointment-purple)',
  'var(--appointment-teal)',
  'var(--appointment-red)',
  'var(--appointment-amber)',
  'var(--appointment-sky)',
  'var(--appointment-pink)',
]

export function getSpecialtyColor(index: number) {
  return SPECIALTY_COLOR_TOKENS[index % SPECIALTY_COLOR_TOKENS.length]
}
