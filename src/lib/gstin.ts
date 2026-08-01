/** Trimmed GSTIN present (not just whitespace / empty string). */
export function hasGstin(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Normalize for storage — empty → null. */
export function normalizeGstin(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Indian GSTIN shape: 15 chars
 * state(2) + PAN(10) + entity(1) + Z + check(1)
 */
export function isValidGstinFormat(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value.trim().toUpperCase(),
  );
}
