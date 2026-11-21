# CORNOD private staging — control plane only

This is a **deployable API container configuration**, not a deployed service.
It does NOT create users, run terminal commands, install tools, start Firecracker, or turn on sign-up.

## Prerequisites

1. A Linux host with Docker Compose, patched and operated by a trusted administrator.
2. A **dedicated** PostgreSQL database; do not use the family-tree database or reuse the legacy shareholder database as-is.
3. The `cornod_app` and `cornod_worker` least-privileged roles, and migrations in `db/` applied by a separate migration owner.
4. An OIDC provider with asymmetric JWT signing and matching API audience/scope.
5. A managed TLS reverse proxy or private network ingress; the Compose file only binds port 8080 to host loopback.
6. A secret manager or an untracked `deploy/.env.staging` file readable only by its administrator.

## Staging start (on the host, not in the browser)

```sh
cp deploy/.env.staging.example deploy/.env.staging
# Edit the private file with real secrets; chmod 600 deploy/.env.staging
docker compose -f deploy/compose.staging.yml up -d --build
curl --fail http://127.0.0.1:8080/health/live
curl --fail http://127.0.0.1:8080/health/ready
```

`/health/live` proves only that the HTTP API process responds. `/health/ready` checks PostgreSQL connectivity. Neither indicates that isolated workspaces, a terminal, billing or user sign-in work.

The repo's API requires a PostgreSQL schema and tenant membership before authenticated routes return useful data. Never use a superuser, database owner or Supabase `service_role` key as the runtime database user.

## Non-negotiable deployment boundary

- Do NOT expose 8080 directly to the Internet. Terminate TLS on a separately configured trusted gateway.
- Do NOT connect `/var/run/docker.sock` to this container.
- Do NOT run tenant commands in this API container.
- The worker and Firecracker Jailer must run under a separately designed, privilege-separated host supervisor on KVM-capable Linux.
- Keep `CONFIG.apiBase` and `CONFIG.wsBase` null in the public frontend until a real authenticated API and single-use terminal-ticket gateway exist; never invent a working terminal indicator.
- No public signup and no workload execution until the release-blocking security gates in `docs/SECURITY-ACCEPTANCE.md` pass.

## Host needed for actual terminal

A separate dedicated KVM-capable Linux machine (or VM with explicitly supported nested KVM) must pass `infra/firecracker/host-preflight.sh`. Staging this API on a generic container host does not provide microVM isolation. Hardware selection, privileged supervisor, guest agent, network policy, terminal attachment and runtime abuse testing are still release blockers.
