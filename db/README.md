# CORNOD PostgreSQL foundation

This directory contains executable PostgreSQL migrations and RLS tests. It is a schema foundation, not a deployed database.

## Database roles

Provision separate roles before applying migrations:

```sql
CREATE ROLE cornod_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE cornod_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
```

Use separate strong credentials from a secret manager. The API role can read tenant data and create typed workspace requests, but cannot update queue state, change membership or alter project assignments. The worker role can claim/update queue jobs and update only the approved workspace lifecycle columns. Neither role owns tables or bypasses RLS.

## API transaction context

For each API request, the trusted service must:
1. Validate the OIDC access token against the configured issuer, audience, JWKS and required API scope.
2. Resolve the active tenant membership and project assignment server-side.
3. Open a database transaction.
4. Set transaction-local `cornod.oidc_issuer`, `cornod.oidc_subject`, `cornod.user_id` and, for tenant routes, `cornod.tenant_id`.
5. Use parameterized SQL, enforce action-level role checks and commit or roll back.

The general API role has no membership or project-assignment write privileges. Invitations, role changes, revocations and assignment changes remain disabled until separately reviewed administrative procedures exist. API-created workspaces must use the authenticated user as `created_by`; audit/event inserts must identify the verified actor.

## Worker boundary

The worker connects only with `cornod_worker`. It claims one job at a time through `internal.claim_next_workspace_job(bytea, integer)`, which uses `FOR UPDATE SKIP LOCKED`, bounded 10–120 second leases and retry exhaustion. Its queue policy allows that database role to claim jobs across tenants; it still does not bypass RLS. Before reading or updating a tenant workspace, it must set the tenant context from the claimed, server-generated job row. It must resolve templates and resource profiles from the server-owned catalog and reject arbitrary image names, shell strings, mounts, capabilities, devices and network settings from tenant input.

The queue is currently not consumed by a deployed worker. A `QUEUED` job does not mean a workspace is running. The worker must eventually use short leases, bounded retries, idempotent transitions, a kill switch and a strongly isolated microVM runtime.

## Apply and test

Apply `migrations/0001_initial.sql through 0007_worker_job_claim.sql` through `0005_workspace_job_queue.sql` using a migration-owner account after provisioning both roles. Never run migrations with the runtime role.

CI applies all migrations to an ephemeral PostgreSQL 16 instance and tests tenant isolation, user-scoped membership/project/ticket/job visibility, worker-only queue access, append-only audit/usage records, and authenticated API behavior.
