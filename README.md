# CORNOD

**BUILD. CONTROL. SECURE.**

CORNOD is a private-in-development cloud engineering workspace.

## Current stage
- Initial responsive control-center interface.
- No public registration.
- No real terminal/runtime is connected yet.
- No user commands are executed by this static frontend.
- No production deployment is intended from this branch.

## Security baseline
- Never execute tenant workloads on the control-plane host.
- Each future workspace must run in an isolated environment with CPU, memory, storage, network and time limits.
- Keep secrets server-side; never commit service-role keys, private tokens or credentials.
- Add authentication, authorization, audit logging and abuse controls before enabling workloads.

## Planned platform areas
1. Identity and access control
2. Isolated Linux workspaces
3. Browser terminal gateway
4. Tool catalog and controlled execution
5. Security learning labs and OSINT workflows
6. Usage quotas, billing and audit trail

## Development
This branch is a private development branch. The default `main` branch and GitHub Pages deployment are intentionally untouched.
