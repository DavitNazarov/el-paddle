# El Padel Documentation

Use this directory as the technical and operational documentation entry point.

- [Architecture](ARCHITECTURE.md): runtime components, domain boundaries, consistency, authorization, and deployment topology.
- [API reference](API.md): request conventions, endpoint groups, CSRF usage, and realtime subscriptions.
- [Tournament operations](TOURNAMENT_OPERATIONS.md): administrator, player, and judge workflow from event setup through result publication.
- [Production deployment](../DEPLOY.md): Docker Compose, Nginx, HTTPS, migrations, updates, and recovery.
- [Feature implementation plan](../FEATURE_IMPLEMENTATION_PLAN.md): detailed product requirements and design decisions.
- [Coding-agent guide](../CLAUDE.md): repository conventions, invariants, security rules, and verification requirements.

When behavior changes, update the smallest authoritative document alongside the code. Update `API.md` for route contracts, `ARCHITECTURE.md` for system boundaries, and `TOURNAMENT_OPERATIONS.md` for user-facing workflow changes.

