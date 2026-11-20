#!/usr/bin/env bash
set -euo pipefail

EXPECTED_VERSION="1.18.0"
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
ok() { printf 'OK: %s\n' "$1"; }

for binary in firecracker jailer; do
  command -v "$binary" >/dev/null 2>&1 || fail "$binary binary is missing"
  version="$("$binary" --version 2>&1 | grep -Eo 'v?[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || true)"
  version="${version#v}"
  [[ "$version" == "$EXPECTED_VERSION" ]] || fail "$binary must be pinned to $EXPECTED_VERSION (found: ${version:-unknown})"
  ok "$binary version $version"
done

firecracker_path="$(command -v firecracker)"
command -v file >/dev/null 2>&1 || fail "file utility is required for static binary verification"
file "$firecracker_path" | grep -q "statically linked" || fail "Firecracker binary must be the official statically linked build"
ok "Firecracker binary is statically linked"

[[ -c /dev/kvm ]] || fail "/dev/kvm is missing; hardware virtualization is unavailable"
[[ -r /sys/fs/cgroup/cgroup.controllers ]] || fail "cgroup v2 is not mounted at /sys/fs/cgroup"
controllers="$(cat /sys/fs/cgroup/cgroup.controllers)"
for controller in cpu memory io pids; do
  [[ " $controllers " == *" $controller "* ]] || fail "cgroup v2 controller $controller is unavailable"
done
ok "KVM device and required cgroup v2 controllers are present"

getent passwd cornod-vmm >/dev/null 2>&1 || fail "dedicated cornod-vmm user is missing"
getent group cornod-vmm >/dev/null 2>&1 || fail "dedicated cornod-vmm group is missing"
ok "dedicated unprivileged VMM identity exists"

for directory in /srv/jailer /var/lib/cornod /var/lib/cornod/templates; do
  [[ -d "$directory" && ! -L "$directory" ]] || fail "required directory is missing or symlinked: $directory"
  owner="$(stat -c '%U' "$directory")"
  [[ "$owner" == "root" ]] || fail "$directory must be owned by root"
  mode="$(stat -c '%a' "$directory")"
  if (( (8#$mode & 0022) != 0 )); then
    fail "$directory must not be group- or world-writable (mode $mode)"
  fi
  ok "$directory is root-owned and not group/world writable"
done

printf '\nHost preflight passed. This does not launch a VM or prove network isolation.\n'
