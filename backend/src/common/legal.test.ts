import { describe, expect, it } from 'vitest';
import { ApiError } from './http.js';
import {
  requireAccountLegalAcceptance,
  requireParticipationLegalAcceptance,
} from './legal.js';

describe('legal acceptance guards', () => {
  it('rejects an account without explicit policy and eligibility acceptance', () => {
    expect(() => requireAccountLegalAcceptance({ legalAccepted: false, eligibilityConfirmed: true }))
      .toThrow(ApiError);
    expect(() => requireAccountLegalAcceptance({ legalAccepted: true, eligibilityConfirmed: false }))
      .toThrow(ApiError);
    expect(() => requireAccountLegalAcceptance({ legalAccepted: true, eligibilityConfirmed: true }))
      .not.toThrow();
  });

  it('rejects a tournament entry missing any required acknowledgement', () => {
    expect(() => requireParticipationLegalAcceptance({ participationTermsAccepted: true, refundPolicyAcknowledged: false, riskAcknowledged: true }))
      .toThrow(ApiError);
    expect(() => requireParticipationLegalAcceptance({ participationTermsAccepted: true, refundPolicyAcknowledged: true, riskAcknowledged: true }))
      .not.toThrow();
  });
});
