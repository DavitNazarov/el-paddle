export const eventInclude = {
  categories: {
    include: {
      category: true,
    },
  },
} as const;

export const registrationInclude = {
  event: true,
  category: true,
  owner: {
    include: {
      clubMemberships: { include: { club: true }, take: 1 },
    },
  },
  teammate: {
    include: {
      clubMemberships: { include: { club: true }, take: 1 },
    },
  },
  reviewedBy: true,
} as const;

export const clubInclude = {
  members: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
} as const;
