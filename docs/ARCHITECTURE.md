# CORNOD — Target Architecture

**Status:** design baseline; not deployed.  
**Product rule:** private development until security acceptance.

## System boundaries
1. **Web control plane** — static UI and authenticated API client. It never executes tenant commands.
2. **Identity and policy service** — authentication, MFA, tenant membership, RBAC/ABAC, session issuance and revocation.
3. **Workspace orchestrator** — creates and destroys isolated workloads; accepts typed job requests, never arbitrary host shell strings.
4. **Execution plane** — disposable per-session microVM/container sandboxes with non-root users, read-only base images, ephemeral writable volumes, seccomp/AppArmor or equivalent, dropped capabilities, PID limits and strict cgroups.
5. **Terminal gateway** — short-lived, single-workspace attachment tokens; no direct public access to runtime ports.
6. **Egress broker** — default-deny outbound network, DNS/IP policy, metadata-service blocks, rate and byte limits.
7. **Audit and metering** — append-only security events, resource accounting, retention policy and abuse signals.

## Trust boundaries
- Browser to API: TLS, secure session cookies where possible, CSRF protection, strict origin policy.
- API to orchestrator: workload identity, mutually authenticated service traffic, schema-validated requests.
- Orchestrator to execution plane: scoped control; no shared host credentials in workloads.
- Tenant to tenant: hard isolation; no shared writable volumes, process namespace, credentials or network by default.

## Required lifecycle
REQUESTED → POLICY_CHECKED → PROVISIONING → READY → ACTIVE → TERMINATING → DESTROYED.
Policy failure becomes REJECTED; runtime health failure becomes QUARANTINED and requires operator review.

## Initial resource ceilings (proposed; tune using load tests)
| Resource | Default ceiling | Hard rule |
|---|---:|---|
| CPU | 1 vCPU | cgroup quota |
| Memory | 1 GiB | hard memory limit |
| Ephemeral storage | 5 GiB | project quota |
| Session duration | 60 minutes | server-enforced TTL |
| Processes | 128 | PID cgroup |
| Outbound network | deny by default | broker allowlist only |

## Secrets
- Never place provider secrets, signing keys, database service-role keys or cloud credentials in browser code or Git.
- Use a managed secret store and short-lived workload identity.
- Rotate credentials and log secret access metadata, never secret values.

## Deployment gates
No public release until identity, isolation, egress policy, audit, quotas, abuse response, backup/restore, incident runbooks and independent security testing pass. This is a target architecture, not proof of deployed controls.

## Related implementation contracts

- Tenant roles and object-level authorization: `docs/AUTHORIZATION-MATRIX.md`.
- Provider-neutral logical data model and isolation rules: `docs/DATA-MODEL.md`.
- Control-plane HTTP contract: `docs/API-CONTRACT.md` and `openapi/cornod-v1.yaml`.
- Release-blocking evidence checklist: `docs/SECURITY-ACCEPTANCE.md`.

These documents are design artifacts only. They do not indicate that the corresponding services or controls are deployed.
