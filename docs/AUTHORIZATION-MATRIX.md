# CORNOD tenant authorization matrix

**Status:** proposed policy; not implemented until enforced by the identity and policy service.

## Roles

- **TENANT_OWNER** — manages tenant membership, policy and billing ownership.
- **TENANT_ADMIN** — manages members and workspaces, but cannot transfer ownership or alter platform-wide security policy.
- **OPERATOR** — operates approved workspaces and manages projects within assigned scope.
- **DEVELOPER** — creates and uses workspaces and projects granted to them.
- **AUDITOR** — read-only access to authorized metadata, usage and audit events.
- **PLATFORM_SUPPORT** — time-limited, ticket-bound support role; no standing access to tenant files or terminal sessions.

## Permission matrix

| Capability | Owner | Admin | Operator | Developer | Auditor | Platform support |
|---|---:|---:|---:|---:|---:|---:|
| View tenant metadata | Yes | Yes | Yes | Yes | Yes | Limited |
| Invite/remove tenant members | Yes | Yes | No | No | No | No |
| Change tenant role assignments | Yes | Yes | No | No | No | No |
| Create workspace | Yes | Yes | Yes | Yes | No | No |
| Start/stop assigned workspace | Yes | Yes | Yes | Own/assigned | No | No |
| Delete workspace | Yes | Yes | Assigned only | Own only, policy-gated | No | No |
| Attach terminal | Yes | Yes | Assigned | Own/assigned | No | No |
| View audit events | Yes | Yes | Scoped | Own activity | Yes | Support case only |
| View usage | Yes | Yes | Scoped | Own usage | Yes | Limited |
| Manage tenant billing | Yes | No | No | No | Read-only | No |
| Transfer tenant ownership | Yes, re-auth required | No | No | No | No | No |
| Access tenant file contents | No implicit access | No implicit access | No implicit access | Workspace-scoped | No | No |

## Enforcement requirements

1. Deny by default. A role is not a substitute for tenant, project and resource ownership checks.
2. Authorize every request at the object level; never trust IDs supplied by the browser.
3. Platform support access requires an approved support case, explicit tenant approval where applicable, a short expiry and a complete audit record. No silent impersonation.
4. Privileged actions require recent re-authentication and MFA. Ownership transfer requires a second confirmation channel.
5. Role changes invalidate or re-evaluate active sessions and cached permissions.
6. Membership removal revokes terminal tickets and prevents new workspace attachments immediately.
7. Cross-tenant negative tests are release-blocking for every object endpoint.
8. Record actor, tenant, action, target ID, outcome, request ID, timestamp and policy version. Never record passwords, session cookies, tickets or terminal content.

## Authorization decision inputs

A policy decision must evaluate: authenticated subject, active membership, tenant, assigned role, resource tenant, project assignment, resource state, action, MFA freshness, support-case context and applicable limits. Missing or inconsistent attributes result in denial.
