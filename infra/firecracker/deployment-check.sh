#!/usr/bin/env bash
# CORNOD deployment acceptance check: read-only, no credentials, no workload execution.
set -euo pipefail
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
ok() { printf 'PASS: %s\n' "$1"; }

[[ "$(uname -s)" == "Linux" ]] || fail "A Linux KVM host is required"
[[ -c /dev/kvm ]] || fail "/dev/kvm is absent: do not deploy Firecracker"
[[ -r /sys/fs/cgroup/cgroup.controllers ]] || fail "cgroup v2 missing"
for c in cpu memory io pids; do
  grep -qw "$c" /sys/fs/cgroup/cgroup.controllers || fail "missing cgroup controller: $c"
done
ok "Linux KVM and cgroups present"

command -v nft >/dev/null || fail "nftables missing; refuse guest networking"
command -v ip >/dev/null || fail "iproute2 missing"
command -v jailer >/dev/null || fail "Firecracker jailer missing"
command -v firecracker >/dev/null || fail "Firecracker binary missing"
ok "Host tooling present"

# Check runtime is not accidentally exposed to untrusted clients.
[[ -z "${CORNOD_EXTERNAL_API_URL:-}" ]] || {
  [[ "$CORNOD_EXTERNAL_API_URL" =~ ^https:// ]] || fail "API must be HTTPS"
  curl -fsS --connect-timeout 3 --max-time 8 "$CORNOD_EXTERNAL_API_URL/health/live" >/dev/null || fail "API liveness unavailable"
  ok "API HTTPS liveness passes (not an isolated-VM acceptance test)"
}
printf '\nPRECHECK ONLY: host supervisor, locked-down egress, vsock guest agent, live VM boot, terminal and clean teardown still require end-to-end tests.\n'
