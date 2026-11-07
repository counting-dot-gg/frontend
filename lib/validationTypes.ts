const DECIMAL_VALIDATION_TYPES = new Set([
  'main',
  'slow',
  'bars',
  'parity',
  'yoco',
  'roulette',
  'tslc',
  'randomhour',
  'randomminute',
  'waitx',
  '1inx',
  'countdown',
  'tugofwar',
  'repdigits',
  'no_repdigits',
  'repeating_digits',
  'mostly_repeating_digits',
  'factoradic',
  'username',
  'fast_tslc',
  'wait_2',
  'incremental_odds',
  'by3',
])

export function isDecimalValidationType(validationType?: string | null): boolean {
  return !!validationType && DECIMAL_VALIDATION_TYPES.has(validationType)
}
