import type { Response } from 'express';

/**
 * CSV for the one thing a tournament still does on paper: a printed entry list,
 * a court sheet, a results page pinned to a wall.
 *
 * A cell that begins with `=`, `+`, `-` or `@` is prefixed with an apostrophe.
 * Spreadsheets read those as the start of a formula, so a club named `=cmd|…`
 * would execute on open — the export is written by the people in the roster, so
 * treat every cell as their text, not ours.
 */
export type CsvValue = string | number | boolean | null | undefined;

const formulaStart = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const guarded = formulaStart.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

export function toCsv(header: string[], rows: CsvValue[][]) {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** A filename a browser will keep and a filesystem will accept. */
export function csvFilename(...parts: string[]) {
  const stem = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${stem || 'export'}.csv`;
}

export function sendCsv(response: Response, filename: string, header: string[], rows: CsvValue[][]) {
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.setHeader('Cache-Control', 'no-store');
  // A BOM so Excel opens Georgian and accented names as UTF-8 rather than
  // guessing a legacy codepage.
  response.send(`﻿${toCsv(header, rows)}`);
}

/** True when the caller asked for CSV, by `?format=csv` or by `Accept`. */
export function wantsCsv(request: { query: Record<string, unknown>; get(name: string): string | undefined }) {
  const format = typeof request.query.format === 'string' ? request.query.format.toLowerCase() : '';
  if (format === 'csv') return true;
  return (request.get('accept') ?? '').includes('text/csv');
}
