# El Padel Documentation

Use this directory as the technical and operational documentation entry point.

## Current documentation

- [Business overview](BUSINESS_OVERVIEW.md): what the product is, the club-centric model, money, lifecycle, and trust mechanics in plain language.
- [Architecture](ARCHITECTURE.md): runtime components, domain boundaries, consistency patterns, authorization, publication model, and deployment topology.
- [API reference](API.md): request conventions, the full endpoint surface with capability requirements, CSRF usage, and realtime subscriptions.
- [Tournament operations](TOURNAMENT_OPERATIONS.md): administrator, club-leader, player, and judge workflow from event setup through result publication, plus the incident checklist.
- [Production deployment](../DEPLOY.md): Docker Compose, Nginx, HTTPS, migrations, updates, backups, and recovery.
- [Coding-agent guide](../CLAUDE.md): repository conventions, invariants, security rules, and verification requirements.

## Historical documents

These are point-in-time artifacts kept for reference. They describe the system as planned or as audited on their stated dates, not necessarily the current implementation.

- [Feature implementation plan](../FEATURE_IMPLEMENTATION_PLAN.md): the original tournament-feature design. Several details evolved during implementation (for example, brackets now size dynamically to 2–16 entries and registration is club-based).
- [Security report](../SECURITY_REPORT.md): production security audit and hardening pass.
- [API performance audit](PRODUCTION_API_PERFORMANCE_AUDIT.md): API usage and payload audit dated 2026-07-17; several findings (such as DTO serialization) have since been addressed.

## Keeping documentation current

When behavior changes, update the smallest authoritative document alongside the code: `API.md` for route contracts, `ARCHITECTURE.md` for system boundaries, `TOURNAMENT_OPERATIONS.md` for user-facing workflow changes, and `BUSINESS_OVERVIEW.md` when the product model itself shifts.
