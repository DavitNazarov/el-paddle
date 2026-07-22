function looksLikeSecretOrInternalError(error: string) {
  return (
    error.includes('__TURBOPACK') ||
    error.includes('Prisma') ||
    error.includes('adapter') ||
    error.includes('ECONNREFUSED') ||
    error.includes('DATABASE_URL') ||
    /postgres(?:ql)?:\/\//i.test(error) ||
    /mongodb(?:\+srv)?:\/\//i.test(error) ||
    /redis:\/\//i.test(error) ||
    /:\/\/[^/\s]+:[^/\s]+@/i.test(error) ||
    error.length > 180
  );
}

export function friendlyError(error: string | undefined, fallback: string, databaseFallback: string) {
  if (!error) return fallback;
  if (looksLikeSecretOrInternalError(error)) {
    return databaseFallback;
  }
  return error;
}
