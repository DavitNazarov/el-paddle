import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { daysUntil, toDatetimeLocalValue } from './dates';
export { friendlyError } from './errors';
