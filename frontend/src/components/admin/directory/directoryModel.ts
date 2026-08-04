import type { AdminUserDto, CategoryDto, ClubDto } from '@/types/admin';
import type { ClubApplication } from '@/types/auth';

/**
 * Pure reading for the four admin directories — users, clubs, categories and
 * club applications. All four ask the same two questions of a list ("find the
 * one I mean" and "show me only the ones in this state"), so the filtering
 * lives here once and the clients only hold the query.
 *
 * Each screen contributes a facet reader and its ordered bucket values. Labels
 * stay in the client, because they come from the locale dictionary and this
 * module must not depend on it.
 */

/** The bucket that means "no filter". Never a real row state. */
export const ALL_FACET = 'ALL';

export type DirectoryQuery = {
  search: string;
  facet: string;
};

export const emptyQuery: DirectoryQuery = { search: '', facet: ALL_FACET };

export type FacetOption = {
  value: string;
  label: string;
  count: number;
};

/**
 * How to read one kind of row: the fields a search term may land in, and which
 * facet bucket it belongs to.
 */
export type DirectoryReader<T> = {
  text: (row: T) => Array<string | null | undefined>;
  facet?: (row: T) => string;
};

/** Words are matched independently, so "ana kutaisi" finds a Kutaisi player named Ana. */
export function searchTerms(search: string): string[] {
  return search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesTerms(fields: Array<string | null | undefined>, terms: string[]): boolean {
  if (!terms.length) return true;
  const haystack = fields.filter(Boolean).join(' ').toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function filterRows<T>(rows: T[], query: DirectoryQuery, reader: DirectoryReader<T>): T[] {
  const terms = searchTerms(query.search);
  const facet = reader.facet;
  return rows.filter((row) => {
    if (query.facet !== ALL_FACET && facet && facet(row) !== query.facet) return false;
    return matchesTerms(reader.text(row), terms);
  });
}

/**
 * Facet chips with their own counts, so the reader can see how much sits behind
 * a filter before choosing it. Counts are taken from the search-filtered rows —
 * a chip must never promise more than clicking it would show.
 */
export function facetOptions<T>(
  rows: T[],
  query: DirectoryQuery,
  reader: DirectoryReader<T>,
  values: readonly string[],
  label: (value: string) => string,
): FacetOption[] {
  const facet = reader.facet;
  if (!facet) return [];
  const terms = searchTerms(query.search);
  const searched = rows.filter((row) => matchesTerms(reader.text(row), terms));
  return [
    { value: ALL_FACET, label: label(ALL_FACET), count: searched.length },
    ...values.map((value) => ({
      value,
      label: label(value),
      count: searched.filter((row) => facet(row) === value).length,
    })),
  ];
}

/* ---- Users ---- */

/**
 * Disqualification outranks the account status: it is the thing an admin came
 * looking for, and a disqualified account is still `ACTIVE` underneath.
 */
export const USER_FACET_VALUES = ['ACTIVE', 'INVITED', 'DISQUALIFIED'] as const;

export function userFacet(user: AdminUserDto): string {
  return user.isDisqualified ? 'DISQUALIFIED' : user.status;
}

export const userReader: DirectoryReader<AdminUserDto> = {
  text: (user) => [user.fullName, user.email, user.phone, user.club?.name],
  facet: userFacet,
};

/* ---- Clubs ---- */

export const CLUB_FACET_VALUES = ['STAFFED', 'EMPTY'] as const;

export function clubFacet(club: ClubDto): string {
  return club.members.length ? 'STAFFED' : 'EMPTY';
}

export const clubReader: DirectoryReader<ClubDto> = {
  text: (club) => [club.name, club.slug, club.description, ...club.members.map((member) => member.user.fullName)],
  facet: clubFacet,
};

/* ---- Categories ---- */

export const CATEGORY_FACET_VALUES = ['IN_USE', 'UNUSED'] as const;

export function categoryInUse(category: CategoryDto): boolean {
  return (category.eventCount ?? 0) > 0;
}

export function categoryFacet(category: CategoryDto): string {
  return categoryInUse(category) ? 'IN_USE' : 'UNUSED';
}

export const categoryReader: DirectoryReader<CategoryDto> = {
  text: (category) => [category.name, category.description],
  facet: categoryFacet,
};

/* ---- Club applications ---- */

export const APPLICATION_FACET_VALUES = ['SUBMITTED', 'PENDING_VERIFICATION'] as const;

/**
 * Only a submitted request is asking the admin for anything. One still waiting
 * on the applicant's email confirmation is waiting on *them*, so it carries no
 * amber flag — amber means "you are being asked for something".
 */
export function awaitsDecision(application: ClubApplication): boolean {
  return application.status === 'SUBMITTED';
}

export function applicationFacet(application: ClubApplication): string {
  return application.status;
}

export const applicationReader: DirectoryReader<ClubApplication> = {
  text: (application) => [
    application.clubName,
    application.email,
    application.name,
    application.surname,
    application.phone,
    application.mateEmail,
  ],
  facet: applicationFacet,
};

export function applicantName(application: ClubApplication): string {
  return [application.name, application.surname].filter(Boolean).join(' ');
}

export function mateName(application: ClubApplication): string {
  return [application.mateName, application.mateSurname].filter(Boolean).join(' ') || application.mateEmail;
}

/**
 * The queue reading behind the meter. Approving or rejecting removes a request
 * from the list entirely, so "decided" is not knowable here — what is knowable,
 * and what the admin actually wants, is how many of the requests in front of
 * them can be decided right now.
 */
export type ApplicationQueue = {
  ready: number;
  total: number;
};

export function applicationQueue(applications: ClubApplication[]): ApplicationQueue {
  return { ready: applications.filter(awaitsDecision).length, total: applications.length };
}
