# CORNOD Delivery Roadmap

## Phase 0 — Foundation
- [x] Separate development branch from the legacy default branch.
- [x] Initial Arabic/English responsive control-plane UI.
- [x] Explicit non-executable preview states.
- [x] Architecture and threat-model baselines.
- [ ] CI validation and accessibility checks.

## Phase 1 — Identity and control plane
- [ ] Choose provider and identity system; require MFA for privileged roles.
- [ ] Tenant model, RBAC/ABAC policy matrix and audit events.
- [ ] API schema, rate limits, CSRF/CORS policy and session revocation.
- [ ] Secret management and environment separation.

## Phase 2 — Isolated execution
- [ ] Select microVM/container runtime and hardened base images.
- [ ] Build orchestrator with typed, allowlisted operations.
- [ ] Implement quotas, TTLs, lifecycle cleanup and quarantine.
- [ ] Build terminal gateway with one-time short-lived attachment tokens.
- [ ] Default-deny network egress broker and metadata protections.

## Phase 3 — Product modules
- [ ] Workspace templates and persistent project storage.
- [ ] Curated developer/security tool catalog with provenance and version pinning.
- [ ] Sandboxed labs with explicit authorization scope.
- [ ] Usage metering, quotas and billing integration.

## Phase 4 — Release readiness
- [ ] Automated unit, integration, authorization and abuse tests.
- [ ] SBOM, dependency and secret scans.
- [ ] Backup/restore and incident-response drills.
- [ ] Independent penetration test and remediation.
- [ ] Private pilot, monitoring and rollback rehearsal.
- [ ] Public launch only after acceptance criteria are signed off.

## Current reality
The checked-in frontend is a static prototype. There is no authentication, database connection, runtime, real terminal, billing or deployed security boundary yet. Never treat the prototype as a production service.
