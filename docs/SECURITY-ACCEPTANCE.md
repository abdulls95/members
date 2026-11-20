# CORNOD security acceptance gates

**Status:** release checklist; no gate is marked passed by documentation alone.

CORNOD remains a private development project until every applicable gate has reproducible evidence, an owner and a recorded review.

## Gate 0 — Repository and delivery

- [ ] Repository visibility and intended release audience reviewed; no secrets or private customer data in Git.
- [ ] Branch protection and least-privilege CI permissions configured.
- [ ] Dependency and GitHub Action versions pinned to reviewed immutable references.
- [ ] Secret scanning, dependency scanning and artifact provenance enabled.
- [ ] Deployment workflow has one authoritative Pages/deployment path and rollback instructions.
- [ ] Static site does not contain privileged keys, internal endpoints or private operational data.

## Gate 1 — Identity and authorization

- [ ] MFA enforced for owners and administrators.
- [ ] Secure session cookie settings, CSRF defenses, origin policy and rate limits verified.
- [ ] Account recovery resists takeover and does not bypass MFA without a controlled process.
- [ ] Tenant and project authorization tested on every read and mutation endpoint.
- [ ] Cross-tenant access tests all fail closed.
- [ ] Role changes and member removal revoke or re-evaluate active access.

## Gate 2 — Execution isolation

- [ ] Untrusted workloads run in a tested microVM boundary or an equivalently justified isolation design.
- [ ] No privileged containers, host socket mounts, host namespaces or unnecessary capabilities.
- [ ] Non-root execution, read-only base image, ephemeral writable volume and hardened syscall policy.
- [ ] CPU, memory, storage, process, time and concurrency quotas are enforced server-side.
- [ ] Workspace lifecycle cleanup, quarantine and operator kill switch tested.
- [ ] No tenant command can execute on the control-plane host.

## Gate 3 — Network and secrets

- [ ] Egress is deny-by-default and mediated by policy.
- [ ] Cloud metadata, host, control-plane and private network destinations are blocked from workloads.
- [ ] DNS rebinding, redirects, IPv6 and alternate IP encodings are included in egress tests.
- [ ] Secrets are stored in a managed secret store and issued only as short-lived scoped credentials.
- [ ] Secret values are redacted from logs, traces, crash reports and support exports.

## Gate 4 — Terminal and audit

- [ ] Terminal tickets are single-use, short-lived, audience/origin bound and revocable.
- [ ] Replay, expiry, cross-workspace and cross-tenant ticket tests pass.
- [ ] Runtime ports are never publicly reachable.
- [ ] Audit events are append-only or tamper-evident and exported to a separately controlled sink.
- [ ] Audit access is role-scoped; terminal content and credentials are not logged by default.

## Gate 5 — Operational readiness

- [ ] Backup and restore exercise meets documented recovery objectives.
- [ ] Incident response, abuse handling, suspension and evidence preservation runbooks tested.
- [ ] Capacity, noisy-neighbor, quota and denial-of-service tests completed.
- [ ] SBOM and vulnerability review completed; critical/high findings remediated or formally risk-accepted.
- [ ] Independent penetration test completed and all release-blocking findings closed.
- [ ] Private pilot, monitoring, rollback and emergency shutdown rehearsed.

## Evidence record

For each checked item, retain: test/configuration reference, date, reviewer, result, exceptions and remediation ticket. A checked box without evidence is not acceptance. Public signup and general availability remain disabled until the release owner signs the complete gate record.
