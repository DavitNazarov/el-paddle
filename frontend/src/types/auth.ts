export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INVITED';

export type UserClub = {
  id: string;
  name: string;
  slug: string;
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
};
