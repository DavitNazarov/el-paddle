import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  emptyPasswordForm,
  hasErrors,
  initialsOf,
  passwordRules,
  sameProfile,
  validatePassword,
  validateProfile,
} from './accountModel';

const long = 'a'.repeat(MIN_PASSWORD_LENGTH);

describe('profile', () => {
  const base = { name: 'Ana', surname: 'Beridze', phone: '555000111' };

  it('sees no change when nothing was edited', () => {
    expect(sameProfile(base, { ...base })).toBe(true);
    expect(sameProfile(base, { ...base, phone: '555' })).toBe(false);
  });

  it('requires a name and surname, ignoring padding', () => {
    const errors = validateProfile({ name: '  ', surname: '', phone: '1' }, false);
    expect(errors).toEqual({ name: 'nameRequired', surname: 'surnameRequired' });
  });

  it('requires a phone only where the server does', () => {
    expect(validateProfile({ ...base, phone: '' }, false).phone).toBeUndefined();
    expect(validateProfile({ ...base, phone: '' }, true).phone).toBe('phoneRequired');
  });
});

describe('password', () => {
  it('asks for the current one only when the account already has a password', () => {
    expect(validatePassword({ ...emptyPasswordForm, newPassword: long, confirmPassword: long }, true).currentPassword)
      .toBe('currentRequired');
    expect(validatePassword({ ...emptyPasswordForm, newPassword: long, confirmPassword: long }, false).currentPassword)
      .toBeUndefined();
  });

  it('rejects a new password below the minimum length', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validatePassword({ currentPassword: 'x', newPassword: short, confirmPassword: short }, true).newPassword)
      .toBe('tooShort');
  });

  it('puts a mismatch on the confirm field, not on the new password', () => {
    const errors = validatePassword({ currentPassword: 'x', newPassword: long, confirmPassword: `${long}z` }, true);
    expect(errors.confirmPassword).toBe('mismatch');
    expect(errors.newPassword).toBeUndefined();
  });

  it('separates an empty confirmation from a wrong one', () => {
    expect(validatePassword({ currentPassword: 'x', newPassword: long, confirmPassword: '' }, true).confirmPassword)
      .toBe('confirmRequired');
  });

  it('accepts a valid change', () => {
    const errors = validatePassword({ currentPassword: 'old', newPassword: long, confirmPassword: long }, true);
    expect(hasErrors(errors)).toBe(false);
  });

  it('tracks the two live rules independently of submission', () => {
    expect(passwordRules({ ...emptyPasswordForm, newPassword: long, confirmPassword: long }))
      .toEqual({ lengthMet: true, matchMet: true });
    expect(passwordRules({ ...emptyPasswordForm, newPassword: 'short', confirmPassword: 'short' }))
      .toEqual({ lengthMet: false, matchMet: true });
    // An empty pair is not a match, or every fresh form would look half-valid.
    expect(passwordRules(emptyPasswordForm).matchMet).toBe(false);
  });
});

describe('initials', () => {
  it('takes the first letter of each name', () => {
    expect(initialsOf({ name: 'Ana', surname: 'Beridze', email: 'a@b.c' })).toBe('AB');
  });

  it('falls back to the email when there is no name yet', () => {
    expect(initialsOf({ name: '', surname: '', email: 'zurab@example.com' })).toBe('Z');
  });
});
