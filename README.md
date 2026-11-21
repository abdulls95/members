# CORNOD

**BUILD. CONTROL. SECURE.**

CORNOD is an early-stage cloud engineering platform project.

> **Visibility notice:** This GitHub repository and its GitHub Pages preview are currently public. The preview is not access-controlled. Do not enter, commit or upload secrets, personal information, customer data or private operational details.

## Live preview

https://abdulls95.github.io/members/

The site is a static frontend preview only. It is not a private workspace or a production service.

## Current implementation

- Rebuilt industrial Arabic/English control center with 14 routes: dashboard, workspaces, terminal, files, marketplace, command library, AI, OSINT, labs, admin preview, settings and status.
- Accessible navigation behavior and a restrictive frontend Content Security Policy.
- Static validation, CSP checks, UI/terminal unit tests and GitHub Actions quality checks.
- OIDC-verifying control-plane API foundation, tenant-scoped routes and a quota-aware workspace request queue.
- Tenant authorization matrix and provider-neutral logical data model.
- Bilingual curated tool catalogue with risk labels, including Sherlock, Nmap, sqlmap and developer tools (catalogue preview only).
- Executable PostgreSQL migrations for tenant isolation, restricted API/worker roles, short-lived ticket scoping, worker-only queue claims and append-only audit/usage permissions.
- CI-backed PostgreSQL isolation, worker-claim, signed-token API and container smoke tests against ephemeral services.
- Tested Firecracker API adapter over per-VM Unix sockets, with a read-only host preflight script for KVM/cgroup/Jailer requirements.
- Architecture, threat model and release-blocking security checklist.

## Not implemented

- Supabase Auth exists in the CORNOD staging project, but existing Auth identities have not been granted CORNOD tenant membership, and browser login/BFF/MFA are not deployed. The API can verify asymmetric Supabase Auth JWTs when configured.
- A Supabase PostgreSQL staging database has been provisioned with CORNOD tables, roles and the private tenant; it is not yet connected to a deployed backend service. CI also tests its migration files against ephemeral PostgreSQL.
- No deployed background worker, Firecracker host supervisor, Linux runtime, isolated workspaces or executable terminal. A tested Firecracker Unix-socket API adapter and queue lease engine exist, but neither launches workloads by itself. Workspace creation only records a `REQUESTED` workspace and `QUEUED` job.
- Tool installation and command execution remain disabled until the isolated runtime and authorization controls are deployed.
- No billing, metering service or production audit pipeline.

The interface deliberately does not simulate successful backend operations.

## Security and delivery rules

- Never execute tenant workloads on the control-plane host.
- Every future workspace must run in a strongly isolated environment with server-enforced CPU, memory, storage, process, network and time limits.
- Keep all privileged secrets server-side in a managed secret store.
- Enforce tenant and object-level authorization on every API request.
- Do not enable public signup or workload execution until the security acceptance gates have been independently verified.

## Private API staging package

A hardened Docker Compose definition for the control-plane API is included in [deploy/](deploy/README.md), along with a non-secret environment template and CI syntax validation. This package is **not deployed**, and it deliberately has no worker, public sign-in, terminal execution, or microVM host. The frontend continues to show an unavailable backend until an authenticated API and isolated runtime are actually deployed and verified.

The legacy shareholders app tables were removed and CORNOD migrations deployed into that Supabase project. The remaining legacy Auth identities have NOT been granted CORNOD membership. See db/README.md for the staging status and security blockers.

## Engineering documents

- [Target architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT-MODEL.md)
- [API contract](docs/API-CONTRACT.md)
- [OpenAPI v1](openapi/cornod-v1.yaml)
- [Authorization matrix](docs/AUTHORIZATION-MATRIX.md)
- [Logical data model](docs/DATA-MODEL.md)
- [Firecracker runtime design](docs/FIRECRACKER-RUNTIME.md)
- [Database migrations and security model](db/README.md)
- [API service implementation and deployment boundary](docs/API-SERVICE.md)
- [Security acceptance gates](docs/SECURITY-ACCEPTANCE.md)\n- [Security reporting policy](SECURITY.md)
- [Delivery roadmap](docs/ROADMAP.md)

## Development

The current default branch is `main`. The old members application is preserved separately in the `legacy-members-backup` branch. The family-tree project is separate and is not part of this repository.
