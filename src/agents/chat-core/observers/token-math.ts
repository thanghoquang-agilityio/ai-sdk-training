const APPROX_CHARS_PER_TOKEN = 4;

/**
 * Estimates token count from char length.
 * @param {number} charLength
 * @returns {number}
 */
export function estimateTokenCountFromCharLength(charLength: number): number {
  if (!Number.isFinite(charLength) || charLength <= 0) {
    return 0;
  }

  return Math.ceil(charLength / APPROX_CHARS_PER_TOKEN);
}

/**
 * Estimates token count.
 * @param {string | null | undefined} value
 * @returns {number}
 */
export function estimateTokenCount(value: string | null | undefined): number {
  const normalized = value?.trim() ?? "";
  return estimateTokenCountFromCharLength(normalized.length);
}
