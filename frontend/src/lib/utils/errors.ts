export function friendlyError(error: string | undefined, fallback: string, databaseFallback: string) {
  if (!error) return fallback;
  if (
    error.includes('__TURBOPACK') ||
    error.includes('Prisma') ||
    error.includes('adapter') ||
    error.includes('ECONNREFUSED') ||
    error.length > 180
  ) {
    return databaseFallback;
  }
  return error;
}
