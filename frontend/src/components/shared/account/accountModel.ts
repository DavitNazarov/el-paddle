/**
 * Pure reading for the account form. Kept out of the component so the password
 * rules can be tested directly — they are the one place on this screen where
 * getting it wrong locks someone out of their own account.
 */

export const MIN_PASSWORD_LENGTH = 12;

export type ProfileForm = {
  name: string;
  surname: string;
  phone: string;
};

export const emptyPasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

export type PasswordForm = typeof emptyPasswordForm;

export function sameProfile(left: ProfileForm, right: ProfileForm) {
  return left.name === right.name && left.surname === right.surname && left.phone === right.phone;
}

export type ProfileFieldError = 'nameRequired' | 'surnameRequired' | 'phoneRequired';
export type ProfileErrors = Partial<Record<keyof ProfileForm, ProfileFieldError>>;

/** Only a player must carry a phone number; the server enforces the same rule. */
export function validateProfile(form: ProfileForm, phoneRequired: boolean): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!form.name.trim()) errors.name = 'nameRequired';
  if (!form.surname.trim()) errors.surname = 'surnameRequired';
  if (phoneRequired && !form.phone.trim()) errors.phone = 'phoneRequired';
  return errors;
}

export type PasswordFieldError = 'currentRequired' | 'tooShort' | 'mismatch' | 'confirmRequired';
export type PasswordErrors = Partial<Record<keyof PasswordForm, PasswordFieldError>>;

/**
 * Errors land on the field that caused them. A mismatch belongs on the confirm
 * box, not in a banner above the form where it reads as a failed save.
 */
export function validatePassword(form: PasswordForm, hasPassword: boolean): PasswordErrors {
  const errors: PasswordErrors = {};

  if (hasPassword && !form.currentPassword) errors.currentPassword = 'currentRequired';
  if (form.newPassword.length < MIN_PASSWORD_LENGTH) errors.newPassword = 'tooShort';

  if (!form.confirmPassword) errors.confirmPassword = 'confirmRequired';
  else if (form.newPassword !== form.confirmPassword) errors.confirmPassword = 'mismatch';

  return errors;
}

export function hasErrors(errors: object) {
  return Object.keys(errors).length > 0;
}

/** The two rules shown as a checklist while the reader types. */
export function passwordRules(form: PasswordForm) {
  return {
    lengthMet: form.newPassword.length >= MIN_PASSWORD_LENGTH,
    matchMet: form.newPassword.length > 0 && form.newPassword === form.confirmPassword,
  };
}

export function initialsOf(user: { name: string; surname: string; email: string }) {
  const letters = [user.name, user.surname]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join('');
  return (letters || user.email.charAt(0)).toUpperCase();
}
