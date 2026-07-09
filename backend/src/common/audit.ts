type AuditFields = {
  event: string;
  outcome?: 'success' | 'failure' | 'denied';
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  detail?: string;
};

/** Structured security audit line (stdout). Never log secrets or tokens. */
export function auditLog(fields: AuditFields) {
  const line = {
    ts: new Date().toISOString(),
    type: 'audit',
    event: fields.event,
    outcome: fields.outcome ?? 'success',
    userId: fields.userId ?? undefined,
    email: fields.email ?? undefined,
    ip: fields.ip ?? undefined,
    detail: fields.detail ?? undefined,
  };
  console.info('[audit]', JSON.stringify(line));
}

export function requestIp(request: { headers: Record<string, unknown>; ip?: string }) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || request.ip || null;
  }
  return request.ip || null;
}
