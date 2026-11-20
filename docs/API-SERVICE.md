# CORNOD API service

**Status:** executable API foundation with authenticated read routes and quota-aware workspace request queuing. It is not deployed or connected to a live database or identity provider.

## Included routes

- `GET /health/live` — process liveness.
- `GET /health/ready` — database readiness.
- `GET /v1/me` — verified identity and active tenant memberships.
- `GET /v1/tenants/{tenantId}/projects` — projects visible to the caller.
- `GET /v1/tenants/{tenantId}/workspaces` — visible workspace metadata with bounded cursor pagination.
- `POST /v1/tenants/{tenantId}/workspaces` — request a workspace from an approved server-side template.
- `GET /v1/tenants/{tenantId}/workspace-jobs/{jobId}` — status of the caller's queued workspace request.
- `GET /v1/tenants/{tenantId}/audit-events` — owner/admin/auditor only.
- `GET /v1/tenants/{tenantId}/usage` — owner/admin/auditor only.

## Workspace request safety

The create endpoint accepts only `templateId`, `displayName`, `resourceProfile` and an optional authorized `projectId`. Unknown fields such as commands, image names, mounts, network settings or runtime flags are rejected. The server resolves active templates and resource profiles from its own catalog, checks project assignment and tenant quotas, and requires an idempotency key.

A successful request creates a workspace in `REQUESTED` state and a queue record in `QUEUED` state in one database transaction. Repeated idempotency keys replay the original result; reusing a key with a different request is rejected. The worker role is separate from the API role and cannot bypass RLS.

**Important:** the queue is not yet consumed by a runtime worker. A queued request is not a running Linux machine. No shell or terminal endpoint exists, and the workspace will remain requested until the isolated runtime worker is implemented and deployed.

## Authentication

The API verifies signed OIDC access tokens using the configured issuer, audience, remote JWKS endpoint and required `cornod:api` scope. It accepts only RS256 or ES256 signatures and rejects expired or over-age tokens. The browser must never store access or refresh tokens in localStorage, sessionStorage, URLs or logs. A production browser login should use Authorization Code + PKCE and a server-side session/BFF with Secure, HttpOnly, SameSite cookies; the current API bearer adapter is an internal service foundation, not the final browser session design.

## Database context and roles

Every authenticated request opens a transaction, sets the verified OIDC issuer/subject, resolves the internal user row and sets the user UUID. Tenant routes set the tenant UUID only after checking active membership. All SQL values are parameterized.

- `cornod_app` serves the API and can create typed workspace requests, but cannot update queue state, modify memberships or change project assignments.
- `cornod_worker` is a separate trusted service role. It can claim/update queue records and update workspace lifecycle metadata, but is not a superuser and does not have `BYPASSRLS`.
- Neither role is shared with a browser or tenant workload. Never expose PostgreSQL directly.

## Runtime configuration

Copy `.env.example` to a private environment configuration and supply real values through a secret manager. Never commit real issuer credentials, database passwords, private keys or client secrets. Production requires TLS for PostgreSQL and exact HTTPS CORS origins.

## Current limits

- No identity provider has been selected or configured.
- No managed PostgreSQL database, API host or runtime worker has been provisioned.
- The queue schema and API request path exist, but there is no worker that consumes jobs or launches microVMs.
- No terminal gateway, tool execution, start/stop actions or public signup exists.
- The in-process IP rate limiter is a development guardrail; production needs gateway/WAF rate limits shared across replicas.
- A committed npm lockfile and dependency provenance review remain production gates.


## Worker queue lease engine

See `docs/WORKER-QUEUE.md` for the queue protocol and runtime boundary. The worker lease module is covered by PostgreSQL integration tests using a separate database login; it must not be confused with a production workload worker.
