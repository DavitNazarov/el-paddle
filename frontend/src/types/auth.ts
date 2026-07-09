export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INVITED';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  surname: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
};
