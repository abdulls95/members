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

Apply migration `0000_supabase_roles.sql` first when the roles do not exist, then `0001_initial.sql` through `0009_private_tenant.sql` in numeric order using a migration-owner account. Database passwords must be provisioned separately in a secret manager. Never run migrations with the runtime role.

CI applies all migrations to an ephemeral PostgreSQL 16 instance and tests tenant isolation, user-scoped membership/project/ticket/job visibility, worker-only queue access, append-only audit/usage records, and authenticated API behavior.

## Supabase staging status (2026-11-20)

The former shareholders project's **application tables** were removed and CORNOD migrations `0000` through `0009` have been successfully applied to Supabase project `ovzjhaykcrtvyoxneydc` (US West). It is a CORNOD staging database, not a public production service. Its two legacy Auth identities remain unassigned to a CORNOD tenant until ownership is independently verified. The private tenant `cornod-private` and quotas exist; no executable VM template, running worker, login gateway, backend host or active workspace exists.

Do not expose this project through the Supabase Data API. None of the CORNOD tables currently grant `anon` or `authenticated` direct data access. `public.resource_profiles` is not RLS-enabled; do not grant access to browser roles. Before any such access is contemplated, design and review its read policies and enable RLS. All other new public tables have RLS enabled. The security advisor also reports leaked-password protection disabled; turn it on in Auth settings before enabling password sign-in.

The server accepts a Supabase Auth access token only after asymmetric JWT signature, issuer, audience and `role=authenticated` are validated. The server must connect with `cornod_app` and authenticate tenant membership inside the database. Supabase's publishable key is **not** a backend database credential. No secret keys belong in the static site.
