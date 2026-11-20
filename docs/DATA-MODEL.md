# CORNOD logical data model

**Status:** provider-neutral design. No database has been provisioned and no schema has been deployed.

## Core entities

| Entity | Purpose | Required ownership boundary |
|---|---|---|
| `users` | Identity-provider subject and minimal profile | Global identity; no workspace data |
| `tenants` | Customer or personal organization boundary | Tenant ID |
| `memberships` | User-to-tenant relationship and role | Unique tenant + user |
| `projects` | User-visible project grouping | Tenant ID + project ID |
| `project_memberships` | Project-level assignment when needed | Tenant ID + project ID + user ID |
| `workspace_templates` | Server-controlled approved runtime templates | Platform-managed; immutable version |
| `workspaces` | Runtime metadata and lifecycle state | Tenant ID + project ID |
| `workspace_events` | Lifecycle and orchestration transitions | Tenant ID + workspace ID |
| `terminal_tickets` | Hashed, single-use attachment ticket metadata | Tenant ID + workspace ID + user ID |
| `audit_events` | Security and administrative event trail | Tenant ID; append-only |
| `usage_ledger` | Metered resource consumption and adjustments | Tenant ID + workspace ID |
| `support_cases` | Explicitly approved support access context | Tenant ID + case ID |

## Mandatory fields and constraints

- Every tenant-owned row carries a non-null `tenant_id`.
- Use opaque UUID identifiers; never expose sequential database keys as authorization tokens.
- Add composite foreign keys where practical so a workspace cannot reference a project from another tenant.
- `memberships` has a unique constraint on (`tenant_id`, `user_id`).
- `workspaces` has a server-owned `template_version`, enumerated lifecycle state, created/updated timestamps and a server-enforced expiry.
- Store terminal ticket hashes only; raw tickets are returned once and never persisted.
- `audit_events` records actor, tenant, action, target type/ID, result, request ID, timestamp and policy version. Application roles cannot update or delete audit rows.
- `usage_ledger` is append-only. Corrections are compensating entries, not edits to historical usage.
- Do not store workspace secrets in ordinary workspace metadata. Use a managed secret store and store only opaque secret references.

## Isolation and query rules

1. Resolve the authenticated user from the verified identity-provider subject.
2. Resolve active tenant membership server-side for every tenant request.
3. Apply tenant filtering in the database layer as defense in depth, not only in UI or API code.
4. Verify project membership and workspace assignment before returning a row or performing an action.
5. A zero-row result for an inaccessible cross-tenant object should not disclose whether the object exists.
6. Use separate database roles for migrations, API runtime, audit ingestion and read-only analytics. Runtime API credentials must not own tables or bypass row policies.
7. Background workers must receive a narrowly scoped job identity and tenant/workspace context; they must not accept arbitrary tenant IDs without a verified job record.

## Retention and deletion

- Workspace ephemeral data is destroyed according to lifecycle policy and verified by cleanup jobs.
- User/tenant deletion follows a documented retention and legal-hold policy.
- Security audit and billing records follow separate retention schedules.
- Backups are encrypted, access-logged and periodically restored in a test environment.
- Deletion workflows must revoke active sessions and terminal tickets before removing membership or tenant data.

## Required database tests

- A user from tenant A cannot read, mutate, infer or subscribe to tenant B records.
- Cross-tenant foreign-key combinations are rejected.
- A removed member immediately loses access through API and database policies.
- API runtime credentials cannot alter audit history or usage history.
- Terminal ticket hashes cannot be replayed and expire as expected.
- Concurrent workspace creation cannot bypass tenant quotas.
- Restore procedures preserve tenant boundaries and audit integrity.
