# CORNOD isolated Linux runtime — Firecracker design

**Selected runtime:** Firecracker microVMs, with the matching Firecracker Jailer.  
**Version baseline:** Firecracker v1.18.0, the supported release current on 2026-11-20 (official support window through 2027-05-09). Re-evaluate the pinned version before every host rollout and patch within the supported window.

## Why this runtime

CORNOD accepts untrusted code and security-tool workloads. A shared-kernel container alone is not the isolation boundary we want. Each workspace therefore receives its own microVM and guest kernel. Containers may be used *inside* a guest for convenience, never as the tenant-to-host security boundary.

## Trust boundaries

```text
Browser
  │ HTTPS / authenticated control-plane API
  ▼
CORNOD control plane ── PostgreSQL tenant/RLS boundary
  │ typed queue job (no command string)
  ▼
Worker (cornod_worker DB role)
  │ verified template + bounded resource profile
  ▼
Privileged host supervisor (small, audited TCB)
  │ dedicated UID/GID, chroot, cgroup v2, network namespace
  ▼
Firecracker Jailer ── Firecracker VMM (seccomp)
  │ per-VM Unix API socket + vsock
  ▼
One guest kernel + read-only base rootfs + separate workspace disk
```

The browser, API process and tenant workload never receive the Firecracker socket, host paths, host credentials, or permission to invoke the jailer.

## Host requirements — release blocking

- Linux host with hardware virtualization and an accessible `/dev/kvm` device.
- cgroup v2 enabled and verified; per-workspace CPU, memory, I/O, process and file-size limits are mandatory.
- Firecracker and Jailer binaries from the same pinned release; use the official static Firecracker build and matching Jailer.
- Start every VMM through the Jailer (or a process boundary proven at least as restrictive). Do not launch the VMM directly in production.
- Dedicated non-privileged Firecracker UID/GID per VM where feasible. The small supervisor holds only the privileges required to create the jail, cgroup and network namespace, then drops them.
- Root-owned, non-world-writable parent directories for binaries, templates and jail roots. Unprivileged users must not be able to replace the Jailer executable, kernel, rootfs, network namespace path or any parent directory.
- Default Firecracker seccomp filters remain enabled. Do not weaken them to make a workload start.
- Host kernel, microcode, Firecracker and guest images receive a documented patch cadence.
- Run `bash infra/firecracker/host-preflight.sh` on a candidate host before admitting it to the worker pool.

## Per-workspace VM configuration

The current API adapter sends only an allowlisted sequence over a per-VM Unix socket:

1. `PUT /machine-config`: server-selected vCPU and memory bounds; SMT disabled.
2. `PUT /boot-source`: staged, digest-verified kernel and fixed boot arguments.
3. `PUT /drives/rootfs`: immutable base image, read-only.
4. `PUT /drives/workspace`: dedicated workspace disk, writable only by that VM.
5. `PUT /network-interfaces/eth0`: a tap device and locally administered guest MAC allocated by the host network manager.
6. `PUT /vsock`: guest CID and a jailed Unix socket path for the guest agent.
7. `PUT /actions`: `InstanceStart`.

The API socket is a Unix-domain socket inside the Jailer chroot. It is never bound to TCP, forwarded to the browser or exposed to tenant code. The adapter does not accept arbitrary API paths, image paths, boot arguments, host interface names or shell commands.

## Image and storage rules

- Templates are server-owned, versioned and digest-pinned. Tenants choose a template ID, never an OCI image, kernel path or rootfs path.
- The host supervisor verifies the kernel and rootfs against the approved template manifest before staging them in the VM jail.
- Base rootfs is read-only. A separate workspace disk is provisioned for each workspace; no host directory is bind-mounted into the guest.
- Persistent data is encrypted at rest by the storage layer. Workspace expiry triggers VM shutdown, network cleanup, disk retention/deletion policy and verification.
- Snapshots are disabled initially. They require separate security review for secret scrubbing, tenant ownership, restore compatibility and patch invalidation.

## Network policy

- Every VM receives a dedicated network namespace and tap device.
- Egress is deny-by-default and mediated by a host policy gateway. The current `server/runtime/egress-policy.js` helper rejects private, local, reserved and non-global-unicast DNS answers; it is not enforcement by itself. No unrestricted bridge to the host LAN.
- Block loopback-to-host tricks, RFC1918/link-local destinations, cloud metadata endpoints, control-plane networks and IPv6 equivalents unless explicitly allowed by a reviewed policy.
- DNS is mediated; redirects and DNS rebinding must be checked at connection time, not only at initial resolution.
- No inbound public port is opened for a workspace. Terminal access is through a separately authenticated gateway and the guest agent over vsock.

## Worker and failure semantics

The current repository contains the PostgreSQL queue claim function, hashed lease-token library, Firecracker Unix-socket API client and a bounded guest-agent protocol library. It does **not** yet contain the privileged host supervisor, network/volume allocator, guest-agent daemon or deployed worker process.

Before a workspace may transition to `READY`, the future worker must:
- verify the queue lease and revalidate the tenant/workspace state;
- load template and resource profile from server-owned records;
- stage and verify images, allocate a jail, cgroup, network namespace, tap device, CID and workspace disk;
- start Jailer and configure Firecracker through the API adapter;
- wait for a bounded guest-agent readiness handshake over vsock;
- atomically record runtime metadata, workspace state and audit event;
- renew the queue lease while provisioning, and clean up all resources on failure or cancellation.

Every create operation must be idempotent by workspace ID. A retry must discover or clean up an existing VM rather than create a second one. If the host supervisor or guest agent is unavailable, the job fails closed; it must never fall back to a host shell or privileged Docker container.

## Current implementation status

- [x] Firecracker v1.18.0 selected as the pinned design baseline.
- [x] Allowlisted Firecracker API client over per-VM Unix socket.
- [x] Validation for UUID, template digest, resource bounds, tap name, MAC and guest CID.
- [x] Staged guest files must be regular non-symlink files inside the jail root.
- [x] Tests for request order, invalid inputs, symlink rejection and VMM API failures.
- [x] Host preflight script (read-only).
- [ ] Host supervisor and Jailer lifecycle management.
- [x] Public-destination validation library for resolved A/AAAA answers (policy helper only; not a gateway or firewall).
- [ ] Network namespace/tap allocator and default-deny egress gateway.
- [ ] Encrypted workspace volume allocator and cleanup verification.
- [x] Bounded guest-agent message validator and typed Sherlock request builder (protocol library only; no guest daemon or transport authentication yet).
- [ ] Guest init/agent daemon, authenticated vsock transport and terminal gateway.
- [ ] End-to-end Firecracker host test on a KVM-capable staging node.
- [ ] Independent security review before enabling tenant workloads.

## Upstream references

- [Firecracker release policy](https://github.com/firecracker-microvm/firecracker/blob/main/docs/RELEASE_POLICY.md)
- [Firecracker Jailer documentation](https://github.com/firecracker-microvm/firecracker/blob/main/docs/jailer.md)
- [Production host setup recommendations](https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md)
- [Firecracker getting started and KVM requirements](https://github.com/firecracker-microvm/firecracker/blob/main/docs/getting-started.md)
