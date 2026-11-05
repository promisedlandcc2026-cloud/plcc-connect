/**
 * Shared opaque dependent card reference (AWCD) validator.
 * Exact format only — no trim/case normalization that alters the value.
 */

/** Opaque dependent card ref: AWCD.<64 lowercase hex> */
export const DEPENDENT_CARD_REF_RE = /^AWCD\.[0-9a-f]{64}$/;

/**
 * True iff value is exactly a valid dependent cardRef string.
 * Does not coerce, trim, or lower-case.
 */
export function isDependentCardRef(value: unknown): value is string {
  return typeof value === 'string' && DEPENDENT_CARD_REF_RE.test(value);
}
