# CORNOD backend (control plane + data plane)

**State: designed, not implemented.** No server code runs today. This folder holds the contracts the frontend already codes against, so the backend can be built to match.

- `api/openapi.yaml`: REST contract (v1)
- `api/pty-protocol.md`: WebSocket PTY protocol (implemented client-side in `site/assets/js/terminal/adapters.js`)
- `api/rbac.md`: the permission matrix the API must enforce

Planned stack: Go services (API, orchestrator, host-agent), Postgres, Redis, and Firecracker + jailer on KVM bare-metal hosts. Rationale is in `docs/ARCHITECTURE.md`.

Next implementation milestones:
1. `host-agent`: boot/stop a Firecracker VM via jailer from a base rootfs, expose a PTY over vsock. Pass acceptance tests 4–5.
2. Networking: tap + nftables default-deny egress policy. Pass tests 1–3.
3. `api`: auth (OIDC), PTY tickets, workspace CRUD, audit log. Pass tests 7–8.
4. Wire `site/assets/js/core/config.js` → `apiBase` / `wsBase`.
