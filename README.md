# CORNOD

**BUILD. CONTROL. SECURE.**

CORNOD (كورنود) is a cloud engineering platform. It gives you real, isolated Linux environments in the browser, together with a terminal, workspaces, a tool marketplace, a command library, OSINT modules, security labs and an AI assistant. The interface is bilingual (Arabic and English).

> **Current state: v0.1 frontend foundation.** The interface is built and tested. The sandbox backend is designed but **not implemented**, and every screen that depends on it is labeled as a preview. See [`docs/STATUS.md`](docs/STATUS.md) or the in-app **Build Status** page.

| Path | What |
|---|---|
| `site/` | Static frontend, no build step. This is the only folder that gets deployed |
| `backend/` | API, PTY and RBAC contracts for the control and data plane |
| `docs/` | Audit, architecture and security, status, deployment |
| `tests/` | `node --test` unit tests, Playwright smoke test |

```bash
npm test && npm run test:e2e
```

Deployment is manual and needs the owner's approval. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
