# CORNOD API v1 — Control-plane contract

**Status:** API foundation implemented for identity reads, tenant-scoped queries and queued workspace requests. The production deployment and runtime worker remain pending.

## Design rules

- All endpoints are HTTPS under `/v1`; JSON requests and responses use UTF-8.
- The current API verifies short-lived OIDC bearer access tokens. A production browser integration should use Authorization Code + PKCE with a server-side session/BFF and Secure, HttpOnly, SameSite cookies. Browser storage must never hold long-lived bearer secrets.
- Every object lookup is scoped by the authenticated tenant and authorized membership. A client-supplied tenant ID is never proof of access.
- The control plane accepts typed operations, not host shell strings, container flags, arbitrary image references or raw orchestration payloads.
- Mutating requests require CSRF protection when cookie-authenticated, an idempotency key where retries could duplicate work, and an audit event.
- Errors use `application/problem+json`; responses include a request ID. Secrets and terminal content are excluded from ordinary application logs.
- Pagination is cursor-based and bounded. Default page size 25; maximum 100.

## Endpoint inventory

| Method | Path | Purpose | Required authority |
|---|---|---|---|
| GET | `/health/live` | Process liveness only; no sensitive details | Public to internal health probes |
| GET | `/health/ready` | Dependency readiness, sanitized | Internal probe |
| GET | `/v1/me` | Current user and memberships | Authenticated |
| GET | `/v1/tenants/{tenantId}/workspaces` | List visible workspaces | Workspace read |
| POST | `/v1/tenants/{tenantId}/workspaces` | Queue a workspace request from an approved template | Workspace create |
| GET | `/v1/tenants/{tenantId}/workspace-jobs/{jobId}` | Read the caller's workspace job state | Job owner |
| GET | `/v1/tenants/{tenantId}/workspaces/{workspaceId}` | Read workspace metadata | Workspace read |
| POST | `/v1/tenants/{tenantId}/workspaces/{workspaceId}/actions` | Start, stop or restart | Workspace operate |
| DELETE | `/v1/tenants/{tenantId}/workspaces/{workspaceId}` | Destroy workspace | Workspace delete |
| POST | `/v1/tenants/{tenantId}/workspaces/{workspaceId}/terminal-tickets` | Issue one-time terminal attachment ticket | Terminal attach |
| GET | `/v1/tenants/{tenantId}/audit-events` | Read tenant audit events | Audit read |
| GET | `/v1/tenants/{tenantId}/usage` | Read metering totals | Usage read |

## Workspace creation

Request fields are deliberately allowlisted:

- `templateId`: identifier from the server-owned, approved template catalog.
- `displayName`: 1–64 characters; plain text.
- `resourceProfile`: one of server-defined profiles such as `starter` or `standard`.
- `projectId`: optional project identifier already authorized for the caller.

The API currently creates a workspace row in `REQUESTED` state and a job in `QUEUED` state. It does not launch a runtime. It rejects client-supplied image names, entrypoints, host paths, mounts, capabilities, devices, network modes, environment secrets, runtime flags and arbitrary command strings. A future worker must resolve templates and resource profiles from trusted server configuration.

## Workspace actions

Allowed action values: `start`, `stop`, `restart`. The action endpoint is not a general-purpose command runner. State transitions are validated server-side and repeated requests are idempotent.

## Terminal attachment

1. The client requests a ticket using an authenticated POST.
2. The service checks tenant membership, workspace ownership, workspace state and terminal permission.
3. A single-use ticket is returned with a maximum 30-second lifetime and a server-side binding to user, tenant, workspace, origin and gateway audience.
4. The browser exchanges the ticket with the terminal gateway over TLS. The ticket is invalidated on first use, expiry, revocation or workspace termination.
5. The gateway connects only to the selected isolated workload. It never exposes a runtime port publicly and never routes to the control-plane host.

Tickets must not be placed in URLs, analytics, referrers or application logs. Terminal output is not copied into the audit trail by default.

## Standard error shape

```json
{
  "type": "https://cornod.invalid/problems/forbidden",
  "title": "Forbidden",
  "status": 403,
  "code": "WORKSPACE_ACCESS_DENIED",
  "requestId": "server-generated-correlation-id"
}
```

Do not return stack traces, infrastructure names, secret values, internal IPs or cross-tenant object existence details.

## Versioning and compatibility

- Additive optional response fields are permitted within v1.
- Breaking request or response changes require a new version.
- Unknown fields with security impact are rejected, not silently forwarded.
- The OpenAPI file in `openapi/cornod-v1.yaml` is the machine-readable companion contract.


## Not exposed by the current API

Workspace start/stop/restart, deletion, terminal tickets, tool execution, membership administration and browser login are design targets only. They are not routes in the current API implementation.
