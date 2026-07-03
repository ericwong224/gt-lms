export function normalizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes('localhost')) return rawUrl;
  if (rawUrl.includes('sslmode=')) {
    return rawUrl.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  }
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}sslmode=no-verify`;
}

export function postgresUrlForDDL(rawUrl) {
  const override = String(process.env.DATABASE_URL_DDL ?? '').trim();
  if (override) return normalizeDatabaseUrl(override);
  const u = normalizeDatabaseUrl(rawUrl);
  if (!u) return u;
  let out = u.replace(/:25061(?=[/?#]|$)/g, ':25060');
  out = out.replace(/([?&])pgbouncer=true(?=&|$)/gi, '$1');
  out = out.replace(/\?&+/g, '?').replace(/&&+/g, '&');
  out = out.replace(/[?&]$/g, '');
  return out;
}
