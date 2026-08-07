export type UserRole = 'USER' | 'ADMIN' | 'JUDGE' | 'ORGANISER';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INVITED' | 'INACTIVE';

export type UserClub = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  surname: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  disqualifiedUntil: string | null;
  disqualificationReason: string;
  isDisqualified: boolean;
  club: UserClub | null;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
  /** Events an organiser currently runs. Empty for every other role. */
  organiserEventIds: string[];
};

export type ClubApplicationStatus = 'PENDING_VERIFICATION' | 'SUBMITTED';

export type ClubApplication = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  status: ClubApplicationStatus;
  emailVerified: boolean;
  clubName: string;
  clubDescription: string;
  mateEmail: string;
  mateName: string;
  mateSurname: string;
  matePhone: string;
  submittedAt: string | null;
  /**
   * Approving this request will create an administrator, because the address is
   * listed in the server's `ADMIN_EMAILS`. Present only on the admin review
   * endpoints — the applicant's own view never carries it, since that would
   * disclose who is on the list.
   */
  grantsAdmin?: boolean;
};

export type ClubApplicationMessage = {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
};
