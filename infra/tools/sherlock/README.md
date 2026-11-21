# CORNOD Sherlock tool payload

**Pinned upstream:** [sherlock-project/sherlock](https://github.com/sherlock-project/sherlock) release `v0.16.2`  
**Package:** `sherlock-project==0.16.2`  
**Purpose:** bounded username-presence checks on public social-network pages.

This directory builds a tool payload image. It is **not** the isolation boundary. The image may only be launched inside a CORNOD guest microVM after the host supervisor, Jailer, network policy and guest agent have passed their release gates. Do not run tenant workloads in the API/control-plane container or directly on the host.

## Build and smoke test

```sh
docker build -t cornod-sherlock:0.16.2 infra/tools/sherlock
docker run --rm --network none cornod-sherlock:0.16.2 --help
```

The image installs a pinned upstream release, runs as UID/GID 10001, and writes results only under the guest's `/workspace/results` directory.

## Deliberate interface restrictions

- Exactly one username, limited to 64 ASCII letters, digits, dots, underscores or hyphens.
- One to five exact site names selected from Sherlock's bundled local site catalogue.
- Fixed 15-second per-site request timeout.
- Uses Sherlock's bundled local data (`--local`); no caller-supplied JSON or remote site-list source.
- No caller-supplied proxy, URL, output path, arbitrary CLI flags, or shell command.
- CSV results are written to the current workspace results directory.

This wrapper is a first safety boundary, not a complete network policy. The guest must still use default-deny egress through the CORNOD broker, with DNS/IP checks at connection time, metadata/private-network blocking, byte/request limits and abuse monitoring. Sherlock's upstream update check may also attempt an outbound request; the production egress policy must explicitly account for or block that behavior.

## Authorized use

Use only for usernames and public profiles you are authorized to assess. Do not use results to harass, impersonate, dox or target people. Results can be stale or false-positive and must not be treated as proof of identity.

## Release status

This payload has not yet been built or executed on a CORNOD KVM host. A successful image build does not mean Sherlock is deployed in the platform. The guest runtime, terminal gateway, workload authorization, audit/metering and KVM end-to-end tests remain separate release gates.
