export type UserRole = 'USER' | 'ADMIN' | 'JUDGE';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INVITED' | 'INACTIVE';

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
