# CORNOD API service

**Status:** executable read-only API foundation; not deployed and not connected to a live database or identity provider.

## Included routes

- `GET /health/live` — process liveness.
- `GET /health/ready` — database readiness.
- `GET /v1/me` — verified identity and active tenant memberships.
- `GET /v1/tenants/{tenantId}/projects` — tenant projects.
- `GET /v1/tenants/{tenantId}/workspaces` — workspace metadata with bounded cursor pagination.
- `GET /v1/tenants/{tenantId}/audit-events` — owner/admin/auditor only.
- `GET /v1/tenants/{tenantId}/usage` — owner/admin/auditor only.

No write, provisioning, terminal, or shell-execution routes are exposed. Those remain disabled until the identity administration path, orchestration boundary and isolated runtime have passed their security tests.

## Authentication

The API verifies signed OIDC access tokens using the configured issuer, audience, remote JWKS endpoint and required `cornod:api` scope. It accepts only RS256 or ES256 signatures and rejects expired or over-age tokens. The browser must never store access or refresh tokens in localStorage, sessionStorage, URLs or logs. A production browser login should use Authorization Code + PKCE and a server-side session/BFF with Secure, HttpOnly, SameSite cookies; the current API bearer adapter is an internal service foundation, not the final browser session design.

## Database context

Project visibility is role-aware: tenant owners, tenant admins and auditors can read the tenant's full project/workspace inventory; operators and developers see only projects assigned to them and workspaces they created or whose projects they are assigned to. Audit and usage reads remain restricted to owner/admin/auditor.

Every authenticated request opens a transaction and sets the verified OIDC issuer/subject. The API resolves the internal user row, sets the internal user UUID, and for tenant routes sets the tenant UUID only after checking an active membership. All SQL values are parameterized. The transaction is committed or rolled back before the pooled connection is released.

The runtime role must be a non-owner, non-superuser, `NOBYPASSRLS` role. The SQL custom settings are trusted only because the database connection is private to the API. Never allow tenant workloads or browsers to connect directly to PostgreSQL.

## Runtime configuration

Copy `.env.example` to a private environment configuration and supply real values through a secret manager. Never commit real issuer credentials, database passwords, private keys or client secrets. Production requires TLS for PostgreSQL and exact HTTPS CORS origins.

## Current limits

- The service is read-only and has no tenant invite or role-change endpoint.
- No identity provider has been selected or configured.
- No managed PostgreSQL database or API hosting has been provisioned.
- The in-process IP rate limiter is a development guardrail; production needs gateway/WAF rate limits shared across replicas.
- No terminal gateway or workload orchestrator exists yet.
- The Dockerfile installs exact top-level dependency versions, but a committed npm lockfile and dependency provenance review are required before production deployment.
