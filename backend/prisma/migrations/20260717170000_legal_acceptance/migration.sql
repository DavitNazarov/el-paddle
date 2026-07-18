ALTER TABLE "User"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "privacyAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "privacyVersion" TEXT,
  ADD COLUMN "eligibilityConfirmedAt" TIMESTAMP(3);

ALTER TABLE "EventRegistration"
  ADD COLUMN "participationTermsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "participationTermsVersion" TEXT,
  ADD COLUMN "refundPolicyAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "refundPolicyVersion" TEXT,
  ADD COLUMN "riskAcknowledgedAt" TIMESTAMP(3);
