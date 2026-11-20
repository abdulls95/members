# RBAC (enforced server-side)

The source of truth for the matrix is `site/assets/js/core/rbac.js`, which is unit-tested. The API must load the same table and deny by default.

| Role | Inherits | Adds |
|---|---|---|
| guest | — | (none) |
| member | — | workspace:read, workspace:create, terminal:connect, files:read, files:write, labs:start, ai:chat |
| developer | member | workspace:delete, tools:install, osint:query |
| admin | developer | admin:users, admin:quotas, admin:audit, admin:system |

Rules: every handler declares one permission, and ownership checks apply in addition to permissions. Admins cannot open another user's PTY unless they use an audited break-glass flow.
