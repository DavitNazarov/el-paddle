/**
 * node-pg does not treat `sslmode=require` the way libpq does, and it rejects
 * `channel_binding`, which Render appends to external Postgres URLs.
 * Internal URLs (local Docker, Render private network) carry neither, and
 * must be left alone so a non-TLS server is not asked for TLS.
 */
export function pgConnectionConfig(connectionString: string): {
  connectionString: string;
  ssl?: { rejectUnauthorized: false };
} {
  const sslMode = readQueryParam(connectionString, 'sslmode');
  const hasChannelBinding = readQueryParam(connectionString, 'channel_binding') != null;
  const needsSsl = sslMode === 'require';
  if (!needsSsl && !hasChannelBinding) return { connectionString };

  let next = connectionString;
  if (hasChannelBinding) next = stripQueryParam(next, 'channel_binding');
  if (needsSsl) next = stripQueryParam(next, 'sslmode');
  return needsSsl
    ? { connectionString: next, ssl: { rejectUnauthorized: false } }
    : { connectionString: next };
}

function readQueryParam(connectionString: string, name: string): string | null {
  const query = connectionString.split('?')[1];
  if (!query) return null;
  return new URLSearchParams(query).get(name);
}

function stripQueryParam(connectionString: string, name: string): string {
  const [base, query] = connectionString.split('?');
  if (!query) return connectionString;
  const params = new URLSearchParams(query);
  params.delete(name);
  const rest = params.toString();
  return rest ? `${base}?${rest}` : base;
}
