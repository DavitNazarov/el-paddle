import { jsonError } from './http.js';

export const ACCOUNT_TERMS_VERSION = '2026-08-06';
export const PRIVACY_POLICY_VERSION = '2026-08-06';
export const PARTICIPATION_TERMS_VERSION = '2026-07-17';
export const REFUND_POLICY_VERSION = '2026-07-17';

export function requireAccountLegalAcceptance(input: {
  legalAccepted: unknown;
  eligibilityConfirmed: unknown;
}) {
  if (input.legalAccepted !== true) {
    jsonError('You must agree to the Terms of Use and acknowledge the Privacy Policy.');
  }
  if (input.eligibilityConfirmed !== true) {
    jsonError('You must confirm that you are at least 18 or have parent or guardian authorization.');
  }
}

export function requireParticipationLegalAcceptance(input: {
  participationTermsAccepted: unknown;
  refundPolicyAcknowledged: unknown;
  riskAcknowledged: unknown;
}) {
  if (input.participationTermsAccepted !== true) {
    jsonError('You must accept the Tournament Participation Terms.');
  }
  if (input.refundPolicyAcknowledged !== true) {
    jsonError('You must acknowledge the Refund and Cancellation Policy.');
  }
  if (input.riskAcknowledged !== true) {
    jsonError('You must acknowledge the physical risks of participating.');
  }
}
