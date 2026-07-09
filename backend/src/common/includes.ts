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
  owner: true,
  teammate: true,
  reviewedBy: true,
} as const;

export const clubInclude = {
  members: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
} as const;
