# El Padel Documentation

Use this directory as the technical and operational documentation entry point.
Everything here describes the system as it is now. There are no historical
documents: a page that stops being true is corrected or deleted, and git history
holds what it used to say.

## The documents

- [Business overview](BUSINESS_OVERVIEW.md): what the product is, the club-centric model, money, lifecycle, and trust mechanics in plain language.
- [Architecture](ARCHITECTURE.md): runtime components, domain boundaries, consistency patterns, authorization, publication model, and deployment topology.
- [API reference](API.md): request conventions, the full endpoint surface with capability requirements, CSRF usage, CSV exports, and realtime subscriptions.
- [Tournament operations](TOURNAMENT_OPERATIONS.md): administrator, club-leader, and player workflow from event setup through result publication, plus the incident checklist.
- [Dashboard design system](DASHBOARD_DESIGN.md): what each role must see and where, the six screen archetypes, and the shared component vocabulary.
- [Security](SECURITY.md): current posture, open items, accepted risks, and the settled product decisions.
- [Environments & deployment workflow](ENVIRONMENTS.md): Render production, the path onto `main`, seeding mock data, and local gotchas.
- [Production deployment](../DEPLOY.md): Render blueprint, domain connection, migrations, backups, and first-admin bootstrap.
- [Coding-agent guide](../CLAUDE.md): repository conventions, invariants, security rules, and verification requirements.

## Which one to change

When behaviour changes, update the smallest authoritative document alongside the
code:

| Change | Document |
| --- | --- |
| A route's contract, capability, or query parameters | `API.md` |
| A system boundary, consistency pattern, or new module | `ARCHITECTURE.md` |
| Something an operator does differently | `TOURNAMENT_OPERATIONS.md` |
| A screen's shape, or a shared component | `DASHBOARD_DESIGN.md` |
| An authorization rule, or a finding opened or closed | `SECURITY.md` |
| The product model itself | `BUSINESS_OVERVIEW.md` |
| Running, seeding, or promoting an environment | `ENVIRONMENTS.md` |

The route source under `backend/src/modules/*/**.routes.ts` is authoritative over
`API.md`; `backend/prisma/schema.prisma` is authoritative over every description
of a model or enum. Where a document and the code disagree, the code is right and
the document is a bug.
