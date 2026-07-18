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

export function requestIp(request: { ip?: string }) {
  return request.ip || null;
}
