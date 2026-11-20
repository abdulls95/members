import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, mkdir, writeFile, rm, symlink, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FirecrackerApiClient, FirecrackerApiError } from "./firecracker-api.js";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function fixture(handler = (_request, response) => response.writeHead(204).end()) {
  const root = await mkdtemp(join(tmpdir(), "cornod-firecracker-"));
  const jailRoot = join(root, workspaceId, "root");
  await mkdir(join(jailRoot, "kernel"), { recursive: true });
  await mkdir(join(jailRoot, "run"), { recursive: true });
  await writeFile(join(jailRoot, "kernel", "vmlinux"), "test-kernel");
  await writeFile(join(jailRoot, "rootfs.ext4"), "test-rootfs");
  await writeFile(join(jailRoot, "workspace.ext4"), "test-workspace-disk");
  const requests = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      requests.push({ method: request.method, path: request.url, body: body ? JSON.parse(body) : null });
      handler(request, response, requests);
    });
  });
  const socketPath = join(jailRoot, "run", "firecracker.socket");
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  const client = new FirecrackerApiClient({ socketRoot: root, jailRootBase: root, timeoutMs: 1000 });
  const spec = {
    workspaceId,
    template: {
      id: "linux-base",
      version: 1,
      imageDigest: "sha256:" + "a".repeat(64),
      bootArgs: "console=ttyS0 reboot=k panic=1 pci=off"
    },
    resources: { cpuCount: 2, memoryMiB: 1024 },
    network: { tapDevice: "tapdeadbeef", guestMac: "02:00:00:00:00:01", guestCid: 42 }
  };
  return {
    root, jailRoot, server, requests, client, spec,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  };
}

test("Firecracker adapter configures and starts only through the per-VM Unix socket", async () => {
  const f = await fixture();
  try {
    const result = await f.client.createWorkspace(f.spec);
    assert.equal(result.state, "START_REQUESTED");
    assert.equal(result.workspaceId, workspaceId);
    assert.deepEqual(f.requests.map((item) => item.path), [
      "/machine-config", "/boot-source", "/drives/rootfs", "/drives/workspace",
      "/network-interfaces/eth0", "/vsock", "/actions"
    ]);
    assert.equal(f.requests[0].body.vcpu_count, 2);
    assert.equal(f.requests[0].body.mem_size_mib, 1024);
    assert.equal(f.requests[2].body.is_read_only, true);
    assert.equal(f.requests[3].body.is_read_only, false);
    assert.equal(f.requests[4].body.host_dev_name, "tapdeadbeef");
    assert.equal(f.requests[5].body.guest_cid, 42);
    assert.deepEqual(f.requests[6].body, { action_type: "InstanceStart" });
  } finally {
    await f.close();
  }
});

test("Firecracker adapter rejects untrusted resource and network parameters", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.client.createWorkspace({
      ...f.spec,
      template: { ...f.spec.template, bootArgs: "console=ttyS0; rm -rf /" }
    }), TypeError);
    await assert.rejects(f.client.createWorkspace({
      ...f.spec,
      resources: { cpuCount: 64, memoryMiB: 1024 }
    }), TypeError);
    await assert.rejects(f.client.createWorkspace({
      ...f.spec,
      network: { ...f.spec.network, tapDevice: "eth0" }
    }), TypeError);
    assert.equal(f.requests.length, 0);
  } finally {
    await f.close();
  }
});

test("Firecracker adapter rejects symlinked guest images", async () => {
  const f = await fixture();
  try {
    const kernel = join(f.jailRoot, "kernel", "vmlinux");
    await unlink(kernel);
    await symlink("/etc/passwd", kernel);
    await assert.rejects(
      f.client.createWorkspace(f.spec),
      (error) => error instanceof FirecrackerApiError && error.code === "FIRECRACKER_KERNEL_IMAGE_INVALID"
    );
    assert.equal(f.requests.length, 0);
  } finally {
    await f.close();
  }
});

test("Firecracker adapter stops configuration when the VMM rejects a request", async () => {
  const f = await fixture((_request, response, requests) => {
    response.writeHead(requests.length === 2 ? 500 : 204).end();
  });
  try {
    await assert.rejects(
      f.client.createWorkspace(f.spec),
      (error) => error instanceof FirecrackerApiError && error.code === "FIRECRACKER_API_REJECTED" && error.status === 500
    );
    assert.deepEqual(f.requests.map((item) => item.path), ["/machine-config", "/boot-source"]);
  } finally {
    await f.close();
  }
});
