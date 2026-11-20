# CORNOD Delivery Roadmap

## Phase 0 — Engineering foundation
- [x] Separate development branch from the legacy default branch.
- [x] Initial Arabic/English responsive control-plane UI.
- [x] Explicit non-executable preview states.
- [x] Architecture and threat-model baselines.
- [x] Navigation accessibility behavior and Escape-to-close support.
- [x] Static validation for duplicate IDs, internal navigation targets and frontend secret patterns.
- [x] Quality workflow runs on pushes to main and pull requests.
- [x] Proposed API contract, OpenAPI document, tenant role matrix, logical data model and release security gates.
- [ ] Validate OpenAPI document with a dedicated schema validator in CI.
- [ ] Add automated browser tests for keyboard, mobile navigation and language switching.

## Phase 1 — Identity and control plane
- [ ] Select hosting, identity provider and data region through an explicit infrastructure decision.
- [x] Implement initial PostgreSQL tenant schema, row-level security and restricted runtime-role grants.
- [x] Add CI integration tests for cross-tenant isolation, terminal ticket owner scope and append-only audit/usage records.
- [ ] Deploy a managed PostgreSQL instance only after infrastructure and region approval.
- [ ] Require MFA for privileged roles and document secure account recovery.
- [x] Implement read-only OIDC access-token verification, current-user and tenant-scoped query routes with role-gated audit/usage reads.
- [x] Add signed-token + PostgreSQL integration tests for tenant boundaries and role enforcement.
- [x] Enforce project-assignment visibility for operators/developers and restrict assignment rows to the assigned user.
- [x] Add microsecond-safe keyset pagination tests for workspace and audit feeds.
- [x] Implement OIDC access-token verification for the API; browser Authorization Code + PKCE and a server-side session/BFF with Secure, HttpOnly, SameSite cookies remain open.
- [ ] Implement tenant membership administration through separately reviewed privileged procedures.
- [x] Implement tenant-scoped API reads and quota-aware workspace request queuing with idempotency.
- [x] Add a separate worker-role queue lease library with hashed one-time lease tokens, renewal, completion, bounded retries and expiry handling.
- [x] Add exact-origin CORS checks, request-size limits, bounded in-process rate limiting and idempotent workspace request handling.
- [ ] Add production gateway rate limits, CSRF protections for the future cookie session and session revocation.
- [ ] Configure managed secret storage and isolated development/staging/production environments.
- [x] Add actor-attributed append-only audit writes for workspace creation requests.
- [ ] Add production audit export, retention controls and tamper-evident archival.

## Phase 2 — Isolated execution
- [ ] Select microVM or equivalently strong runtime isolation and hardened base images.
- [x] Add a typed, quota-aware workspace request API and idempotent job queue.
- [x] Define typed, allowlisted workspace request operations and a database queue.
- [ ] Build the trusted orchestrator and runtime adapter; queue lease primitives exist but do not launch workloads.
- [ ] Implement quotas, TTLs, lifecycle cleanup and quarantine.
- [ ] Build a terminal gateway with one-time short-lived attachment tickets.
- [ ] Implement default-deny network egress and cloud metadata protections.
- [ ] Prove that tenant commands cannot execute on the control-plane host.

## Phase 3 — Product modules
- [ ] Workspace templates and persistent project storage.
- [ ] Curated developer/security tool catalog with provenance and version pinning.
- [ ] Sandboxed labs with explicit authorization scope.
- [ ] Usage metering, quotas and billing integration.
- [ ] User-facing operational status and support workflows.

## Phase 4 — Release readiness
- [ ] Automated unit, integration, authorization and abuse tests.
- [ ] SBOM, dependency and secret scans.
- [ ] Backup/restore and incident-response drills.
- [ ] Independent penetration test and remediation.
- [ ] Private pilot, monitoring and rollback rehearsal.
- [ ] Public launch only after every security acceptance gate is evidenced and approved.

## Current reality

The checked-in frontend is a static prototype. The API service, PostgreSQL migrations and worker queue lease library are executable code with CI coverage, but they are not deployed. The API can verify externally issued OIDC access tokens when configured; no identity provider, user-facing login/BFF, managed database, API host, background worker or isolated runtime has been provisioned. There is no real Linux terminal, billing service or production security boundary. A queued request is not a running machine.
