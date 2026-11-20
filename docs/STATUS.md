# CORNOD — Build status

Last updated: 2026-11-20 · Version 0.1.0 · Branch `cornod/foundation`

## Done and tested
- [x] Repo audit (`docs/AUDIT.md`)
- [x] Project structure: `site/` (frontend), `backend/` (contracts), `docs/`, `tests/`
- [x] Industrial dark UI (graphite / orange / metallic), responsive desktop / tablet / phone, mobile drawer
- [x] 14 routes + 404, hash routing (works on GitHub Pages)
- [x] Arabic / English with automatic RTL / LTR. Dictionary parity is enforced by tests
- [x] Terminal UI: history, local `:` commands, WebSocket PTY client with ticket auth. Says clearly that it is **not connected**
- [x] RBAC model (guest / member / developer / admin) with inheritance, plus UI route gating
- [x] Command library: search and copy (fully works, static data)
- [x] Marketplace, OSINT, Labs, Dashboard, Workspaces, Files, AI and Admin screens. Each one is labeled **Preview** or **Planned** and has its actions disabled
- [x] `/status` page: an in-app ledger of what is live, previewed or planned
- [x] Security: strict CSP, no inline scripts, escaping template tag, `textContent` for terminal output, no secrets
- [x] Architecture and isolation decision (Firecracker, with gVisor as interim), plus API, PTY and RBAC contracts
- [x] Deploy workflow limited to `site/`, **manual only**, and it needs typing `DEPLOY`
- [x] Tests: 11 unit tests + a browser smoke test (15 routes × 2 languages × 3 viewports, plus behavior checks). All pass

## Not done (needs the backend)
- [ ] Authentication / accounts
- [ ] Sandbox orchestrator, Firecracker host-agent, networking policy
- [ ] Real command execution, file storage, tool installs
- [ ] OSINT broker, lab networks, AI gateway
- [ ] Admin data, quotas, audit log, monitoring, backups
- [ ] Production hosting headers (HSTS, frame-ancestors) via a CDN

## Known limits of the current frontend
- The terminal is line-based. Full-screen programs (vim, htop) need raw-mode rendering. The plan is to vendor xterm.js behind the same adapter interface when the PTY backend exists.
- The "preview role" in Settings only changes what the UI shows. It grants nothing.
