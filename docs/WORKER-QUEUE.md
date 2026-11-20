# CORNOD workspace queue and worker lease protocol

**Status:** executable queue lease primitives with CI coverage. No continuously running worker or runtime adapter is deployed.

## Queue state model

`QUEUED → LEASED → SUCCEEDED`

A leased job may be retried after a transient failure or lease expiry. After the configured maximum attempts, it becomes `FAILED`. Queue transitions are stored in PostgreSQL and are not controlled by the browser.

## Lease protocol

1. A trusted worker connects with the separate `cornod_worker` database role. This role is not used by the API or browser.
2. `claimNextJob` uses `FOR UPDATE SKIP LOCKED` to claim one eligible job without blocking other workers.
3. The worker receives a cryptographically random 256-bit opaque lease token. Only its SHA-256 hash is stored in the database.
4. The worker renews the lease before expiry. Every renewal, completion or failure is conditional on the job ID, current lease hash, state and unexpired lease.
5. A stale worker cannot complete or fail a job after another worker has reclaimed it.
6. Transient failures use bounded exponential backoff. The worker records a short uppercase error code, never raw logs, tokens or secrets.
7. Expired jobs at their attempt limit are moved to `FAILED`.

## Runtime boundary

The queue module does not execute shell commands, build images, create containers or launch Linux environments. A production worker must call a separately reviewed runtime adapter that:
- accepts only server-owned template IDs and immutable image digests;
- maps a small set of server-defined resource profiles to hard CPU, memory, storage, process and time limits;
- creates a microVM or an equivalently justified strong isolation boundary;
- enforces deny-by-default network egress and blocks host, metadata and control-plane destinations;
- uses a deterministic workspace ID as an idempotency key to survive worker retries;
- supports cancellation, quarantine, cleanup and an emergency kill switch.

Do not substitute a privileged Docker daemon or host shell for the runtime adapter. The API and worker roles must never be shared with tenant workloads.

## CI evidence

The API integration workflow uses a separate worker database login to test claim, renewal, rejection of a wrong lease token, successful completion and retry scheduling. The database security workflow separately verifies that the worker role cannot bypass RLS and has only the intended column-level update privileges.

## Current limitation

The queue lease engine is a reusable library, not a deployed background process. No job is automatically consumed outside the test suite, and a `QUEUED` workspace request does not represent a running machine.
\n\nThe current Firecracker API client configures the VM over a per-workspace Unix socket after a trusted host supervisor has staged the jail. It does not launch Jailer or provide a terminal by itself. See `docs/FIRECRACKER-RUNTIME.md` for the selected v1.18.0 host boundary and release gates.\n