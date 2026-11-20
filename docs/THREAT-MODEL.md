# CORNOD Threat Model

**Scope:** planned multi-tenant cloud development and security-lab platform. This is a working threat model, not a completed security assessment.

## Assets
- Tenant source code, files, environment variables and credentials.
- Workspace execution sessions and attached terminals.
- Identity records, billing/usage records and audit trails.
- Control-plane credentials, signing keys and deployment pipelines.

## Adversaries
- Malicious authenticated tenant attempting cross-tenant access.
- Anonymous attacker targeting login, APIs or exposed services.
- Compromised package/tool attempting persistence or exfiltration.
- Abusive tenant consuming compute, storage, IP reputation or network bandwidth.
- Insider or compromised CI identity attempting privileged deployment.

## Principal threats and required mitigations
| Threat | Required mitigation | Verification |
|---|---|---|
| Container escape | MicroVM boundary for untrusted workloads; hardened host; patched runtime | Independent escape testing |
| Cross-tenant data access | Per-tenant authorization on every object; isolated volumes and identities | Negative authorization tests |
| Cloud metadata theft | Block link-local metadata and host routes from workloads | Network policy tests |
| Secret leakage | No secrets in frontend; short-lived credentials; redaction | Secret scanning and runtime tests |
| Malicious egress | Default-deny egress, DNS/IP filtering, byte and rate limits | Egress abuse tests |
| Resource exhaustion | CPU/memory/PID/storage/TTL quotas and admission control | Load and quota tests |
| Terminal token theft | One-time short TTL tokens, origin binding, revocation | Replay and expiry tests |
| Supply-chain compromise | Pinned dependencies/actions, SBOM, vulnerability scans | CI policy checks |
| Privilege escalation | Least privilege, MFA for operators, separation of duties | Role matrix tests |
| Audit tampering | Append-only remote audit sink and integrity controls | Tamper-evidence test |

## Non-negotiable controls
1. No tenant command executes on the control-plane host.
2. No privileged container, host socket mount, host PID/network namespace or unrestricted capabilities.
3. No public workspace endpoint; terminal access only through authenticated gateway.
4. No unrestricted outbound internet from workspaces.
5. No public signup before security release gates pass.

## Release-blocking unknowns
- Selected cloud provider and region.
- Runtime isolation technology and patch cadence.
- Identity provider, MFA and account recovery design.
- Egress broker implementation and abuse response ownership.
- Data retention, backup and incident response requirements.

A control is not considered implemented because it appears in this document. Each requires evidence from configuration, tests and operational monitoring.
