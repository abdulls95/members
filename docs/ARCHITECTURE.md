# CORNOD Architecture

> Status legend: **[built]** implemented and tested in this repo · **[designed]** specified here, not yet implemented · **[decision]** chosen approach.

## 1. System overview

```
 Browser (site/, static, GitHub Pages / CDN)                         [built]
   │  HTTPS (REST)                 WSS (PTY stream, ticket auth)
   ▼                               ▼
 ┌──────────────────────── Control plane ────────────────────────┐  [designed]
 │ API gateway  → Auth (OIDC, sessions, MFA)                      │
 │              → RBAC/quota service (same matrix as rbac.js)     │
 │              → Workspace service  → Orchestrator (scheduler)   │
 │              → Catalog (tools, labs, commands)                 │
 │              → OSINT broker (server-side, logged, rate-limited) │
 │              → AI gateway (keys server-side only)              │
 │ Postgres (state) · Redis (sessions/rate limits) · Audit log    │
 └───────────────────────────────┬────────────────────────────────┘
                                 │ mTLS, private network only
 ┌──────────────────────── Data plane (KVM hosts) ───────────────┐  [designed]
 │ host-agent ── jailer ── Firecracker microVM (1 per workspace)  │
 │                         └ guest-agent: PTY, file API, health   │
 │ per-VM: tap device → nftables egress policy → NAT             │
 │ per-VM: rootfs (read-only base) + overlay + persistent volume  │
 └────────────────────────────────────────────────────────────────┘
```

The frontend is static so it can be hosted anywhere with no server-side secrets. Everything that executes code, holds credentials, or makes outbound requests on a user's behalf lives behind the API.

## 2. Isolation technology — evaluation and decision

| | Firecracker microVM | gVisor (runsc) | Kata Containers |
|---|---|---|---|
| Boundary | Hardware virtualization (KVM); own guest kernel | User-space kernel intercepting syscalls | Lightweight VM per pod (QEMU / Cloud Hypervisor / Firecracker) |
| Escape surface | Small VMM (~50k lines Rust), minimal device model | Sentry + host syscall subset; no hardware boundary | VM boundary + more moving parts |
| Startup | ~125 ms boot, snapshots for faster resume | ~instant (container) | Hundreds of ms – seconds |
| Density / overhead | Low (≈5 MB VMM overhead) | Very low | Medium |
| Compatibility | Full Linux (real kernel: systemd, Docker-in-VM, raw sockets for labs) | Some syscalls / `/proc` / networking differences; some tools misbehave | Full Linux |
| Ops requirements | Bare-metal or nested-virt KVM hosts | Any Linux host / Kubernetes RuntimeClass | KVM hosts + Kubernetes integration |
| Proven at scale for multi-tenant untrusted code | AWS Lambda / Fargate | Google Cloud Run / GKE Sandbox | Several cloud providers |

**[decision] Firecracker microVMs for user workspaces and security labs.** A terminal platform gives users a root shell by design, and labs deliberately run exploit tooling. That calls for a hardware virtualization boundary and a real kernel, which gVisor does not provide.

**[decision] gVisor as an interim/secondary runtime.** If KVM-capable hosts are not available at first launch, a gVisor-on-Kubernetes tier can serve *non-lab* developer workspaces with the same API. The UI already labels risk per tool so high-risk tools can be gated to the Firecracker tier only.

Kata is not chosen: it gives the same VM boundary as Firecracker with more moving parts. We only need Kubernetes-pod semantics if we adopt Kubernetes for the data plane, and we don't yet.

**None of these runtimes is implemented or tested in this repository yet.** Section 5 lists the acceptance tests that must pass before the sandbox is marked live in `site/assets/js/data/catalog.js → FEATURES`.

## 3. Security controls (data plane)

| Requirement | Control | State |
|---|---|---|
| One environment per user | One microVM per workspace; workspace bound to owner ID in control plane | designed |
| Real isolation | KVM + Firecracker **jailer** (chroot, new PID/net/mount namespaces, seccomp, dropped caps, unprivileged UID per VM) | designed |
| CPU / RAM limits | vCPU count + memory size fixed at boot; host cgroup v2 `cpu.max`, `memory.max` on the jailer cgroup | designed |
| Storage limits | Fixed-size ext4 volume per workspace; overlay rootfs; host-side quota | designed |
| Process limits | Guest `pids.max` via cgroup in guest + host cgroup `pids.max` on VMM | designed |
| Network / egress | Per-VM tap → nftables: default-deny egress, allow DNS via resolver + HTTP(S) via egress proxy with domain allowlist; per-VM bandwidth shaping (tc) | designed |
| Block metadata & internal | nftables drop to `169.254.0.0/16`, RFC1918 control-plane ranges, host IPs, and every other VM's tap; no VM-to-VM routing | designed |
| Labs | Lab VMs on a separate isolated bridge with **no internet egress**; targets are VMs on the same lab bridge | designed |
| Idle shutdown | Guest-agent heartbeat + PTY activity; idle 30 min → snapshot & stop; hard stop at plan max session length | designed |
| Logging | Control-plane audit log (append-only): auth, workspace lifecycle, PTY session open/close, tool installs, OSINT queries, admin actions. PTY *content* is not recorded by default (privacy); lab sessions may opt in | designed |
| RBAC | `guest < member < developer < admin`, permission matrix in `site/assets/js/core/rbac.js` (UI) mirrored and **enforced** in API | UI model built; API designed |
| Backups / restore | Nightly volume snapshots (retention 7 daily / 4 weekly); Postgres PITR; quarterly restore drill | designed |
| Monitoring | Prometheus metrics (host + per-VM), alerts on host saturation, escape-indicator signals (VMM crash, jailer errors), Grafana dashboards; feeds `/admin` health | designed |

### PTY authentication
The browser never holds long-lived tokens for the PTY. It calls `POST /v1/pty/tickets` (session cookie, `SameSite=Strict`, CSRF-protected) and receives a single-use ticket (≤30 s TTL, bound to user + workspace). It then opens `wss://…/pty?ticket=…`. Implemented client-side in `site/assets/js/terminal/adapters.js` [built, unit-tested against a mock socket].

### Web security
- CSP in `site/index.html`: `script-src 'self'`, no inline scripts, no third-party scripts. [built]
- All dynamic HTML goes through the escaping `html` template tag; terminal output is inserted via `textContent`. [built, tested]
- `frame-ancestors`, HSTS and other response headers must be set by the hosting layer (GitHub Pages cannot); the production CDN config will set them. [designed]
- No secrets in the frontend or the repo. `config.js` holds only public URLs. [built]

## 4. Frontend structure [built]

```
site/
  index.html              shell + CSP
  assets/css/cornod.css   design tokens, logical (RTL-safe) properties, responsive
  assets/js/app.js        route table, chrome, permission gating
  assets/js/core/         i18n, router (hash), rbac, store (prefs only), ui (escaping), config, icons
  assets/js/terminal/     adapters (Disconnected, WebSocket) + DOM-free controller
  assets/js/views/        page modules: render(ctx) → HTML, mount(root) → cleanup
  assets/js/data/         catalogs + honest feature ledger (/status)
```

No build step, no runtime dependencies. Any static host works.

## 5. Sandbox acceptance tests (must pass before "live")

1. VM-to-VM: from VM A, `ping`/TCP to VM B's IP and to host bridge IP → blocked.
2. Metadata: `curl 169.254.169.254` → blocked; control-plane CIDRs → blocked.
3. Egress: non-allowlisted domain → blocked; allowlisted → allowed via proxy; lab VM → no internet.
4. Resources: fork bomb hits `pids.max` without affecting host; `stress-ng` memory → OOM inside guest only; disk fill → stops at quota.
5. Jailer: VMM process runs as unique unprivileged UID in its chroot with seccomp filter active.
6. Idle: no activity for the idle window → snapshot + stop; resume restores files.
7. Auth: replaying a used PTY ticket → rejected; ticket for another user's workspace → rejected.
8. Audit: every lifecycle action above produces an audit record.
