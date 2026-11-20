# CORNOD

**BUILD. CONTROL. SECURE.**

CORNOD is an early-stage cloud engineering platform project.

> **Visibility notice:** This GitHub repository and its GitHub Pages preview are currently public. The preview is not access-controlled. Do not enter, commit or upload secrets, personal information, customer data or private operational details.

## Live preview

https://abdulls95.github.io/members/

The site is a static frontend preview only. It is not a private workspace or a production service.

## Current implementation

- Responsive Arabic/English control-center interface.
- Accessible navigation behavior and a restrictive frontend Content Security Policy.
- Static validation and GitHub Actions quality checks.
- Implemented OIDC bearer API foundation, current-user and tenant-scoped read routes, plus a quota-aware workspace request queue.
- Proposed tenant authorization matrix and provider-neutral logical data model.
- Executable PostgreSQL migrations for tenant-owned records, row-level security, worker job leases, actor-scoped audit/events and append-only usage permissions.
- CI-backed PostgreSQL isolation, worker queue claim, signed-token API and container smoke tests against ephemeral services.
- Architecture, threat model and release-blocking security checklist.

## Not implemented

- No identity provider, browser login, MFA enrollment or live tenant accounts have been configured. The repository contains an OIDC-verifying API service with tenant-scoped reads and quota-aware workspace request queuing, but no identity provider is configured or deployed.
- No managed database has been provisioned or connected to a live service. The repository contains reviewed migrations and CI-tested PostgreSQL isolation policies.
- No Linux runtime, isolated workspaces or executable terminal. Workspace creation only records a `REQUESTED` workspace and `QUEUED` job; no worker launches it yet.
- No tool installation or command execution.
- No billing, metering service or production audit pipeline.

The interface deliberately does not simulate successful backend operations.

## Security and delivery rules

- Never execute tenant workloads on the control-plane host.
- Every future workspace must run in a strongly isolated environment with server-enforced CPU, memory, storage, process, network and time limits.
- Keep all privileged secrets server-side in a managed secret store.
- Enforce tenant and object-level authorization on every API request.
- Do not enable public signup or workload execution until the security acceptance gates have been independently verified.

## Engineering documents

- [Target architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT-MODEL.md)
- [API contract](docs/API-CONTRACT.md)
- [OpenAPI v1](openapi/cornod-v1.yaml)
- [Authorization matrix](docs/AUTHORIZATION-MATRIX.md)
- [Logical data model](docs/DATA-MODEL.md)
- [Database migrations and security model](db/README.md)
- [API service implementation and deployment boundary](docs/API-SERVICE.md)
- [Security acceptance gates](docs/SECURITY-ACCEPTANCE.md)\n- [Security reporting policy](SECURITY.md)
- [Delivery roadmap](docs/ROADMAP.md)

## Development

The current default branch is `main`. The old members application is preserved separately in the `legacy-members-backup` branch. The family-tree project is separate and is not part of this repository.
