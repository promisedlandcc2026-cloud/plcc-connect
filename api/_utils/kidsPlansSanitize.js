/**
 * Sanitize Vault kids-plans list for Connect (read-only; no uploader / delete).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asNullableString(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

function sanitizeSignedUrl(value) {
  const raw = asNullableString(value);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} row
 * @returns {object | null}
 */
export function sanitizeKidsPlanRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  /** @type {Record<string, unknown>} */
  const r = row;
  const id = asNullableString(r.id);
  if (!id || !UUID_RE.test(id)) return null;

  const serviceDate = asNullableString(r.serviceDate) || asNullableString(r.service_date);
  const classroom = asNullableString(r.classroom);
  if (!serviceDate || !classroom) return null;

  return {
    id,
    serviceDate,
    classroom: classroom.slice(0, 80),
    title: asNullableString(r.title),
    notes: asNullableString(r.notes),
    fileName: asNullableString(r.fileName) || asNullableString(r.file_name),
    contentType: asNullableString(r.contentType) || asNullableString(r.content_type),
    signedUrl: sanitizeSignedUrl(r.signedUrl),
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, plans: object[] } | { ok: false, reason: string }}
 */
export function parseVaultKidsPlansResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'not_object' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (!Array.isArray(b.plans)) {
    return { ok: false, reason: 'missing_plans' };
  }
  const plans = [];
  for (const row of b.plans) {
    const sanitized = sanitizeKidsPlanRow(row);
    if (sanitized) plans.push(sanitized);
  }
  return { ok: true, plans };
}

/**
 * @param {unknown} year
 * @param {unknown} classroom
 */
export function parseKidsPlansQuery(year, classroom) {
  const y = String(year || '').trim();
  const c = String(classroom || '').trim().slice(0, 80);
  return {
    year: /^\d{4}$/.test(y) ? y : '',
    classroom: c,
  };
}
