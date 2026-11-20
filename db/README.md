# CORNOD PostgreSQL foundation

This directory contains the first executable persistence layer for CORNOD. It is a schema migration and a PostgreSQL row-level-security smoke test, not a deployed database.

## Database role

Provision a dedicated runtime role before applying migrations:

```sql
CREATE ROLE cornod_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
```

The role must not own tables, be a member of a privileged role, or be shared with a browser or tenant workload. The migration grants only the operations currently needed by the proposed control plane. Audit and usage records are append-only for this role.

## Transaction context

For each request, the trusted API must:
1. Validate the OIDC token against the configured issuer and audience.
2. Resolve the active tenant membership and permissions server-side.
3. Open a database transaction.
4. Set `SET LOCAL cornod.user_id = '<verified-user-uuid>'` and `SET LOCAL cornod.tenant_id = '<authorized-tenant-uuid>'`.
5. Perform parameterized SQL only, enforce action-level role checks, and commit or roll back.

The custom settings are transaction-local so pooled connections cannot retain one request's tenant context for another request. RLS is defense in depth; it does not replace API authorization or safe parameterized queries. Do not expose a database connection to browsers.

## Apply

Apply `migrations/0001_initial.sql` using a migration owner account after provisioning `cornod_app`. Run migrations through a reviewed deployment pipeline. Do not run the migration with the runtime application role.

## Tests

`tests/rls-smoke.sql` seeds two isolated tenants, switches to the restricted runtime role, and verifies tenant scoping plus append-only audit/usage permissions. CI runs this test against an ephemeral PostgreSQL service. It does not use a production database or secrets.
