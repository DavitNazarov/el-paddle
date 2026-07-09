export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function parseOptionalDateTime(value: unknown) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}
