/**
 * Pure prefetch gate rules shared with tests (no browser APIs required).
 * @param {{ saveData?: boolean, effectiveType?: string } | null | undefined} conn
 */
export function connectionLooksConstrainedForTest(conn) {
  if (!conn) return false;
  if (conn.saveData) return true;
  const t = String(conn.effectiveType || '');
  return t === 'slow-2g' || t === '2g';
}

/**
 * @param {{ saveData?: boolean, effectiveType?: string } | null | undefined} conn
 */
export function shouldPrefetch(conn) {
  return !connectionLooksConstrainedForTest(conn);
}
