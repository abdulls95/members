import http from "node:http";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const ENDPOINTS = Object.freeze([
  "/machine-config",
  "/boot-source",
  "/drives/rootfs",
  "/drives/workspace",
  "/network-interfaces/eth0",
  "/vsock",
  "/actions"
]);

export class FirecrackerApiError extends Error {
  constructor(code, status = null) {
    super(code);
    this.name = "FirecrackerApiError";
    this.code = code;
    this.status = status;
  }
}

function inside(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}

async function assertRegularFile(root, candidate, code) {
  if (!isAbsolute(candidate) || !inside(root, candidate)) throw new FirecrackerApiError(code);
  let stat;
  let real;
  try {
    stat = await lstat(candidate);
    real = await realpath(candidate);
  } catch {
    throw new FirecrackerApiError(code);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || !inside(root, real)) {
    throw new FirecrackerApiError(code);
  }
}

async function assertUnixSocket(root, candidate) {
  if (!isAbsolute(candidate) || !inside(root, candidate)) throw new FirecrackerApiError("FIRECRACKER_SOCKET_PATH_INVALID");
  let stat;
  let real;
  try {
    stat = await lstat(candidate);
    real = await realpath(candidate);
  } catch {
    throw new FirecrackerApiError("FIRECRACKER_SOCKET_UNAVAILABLE");
  }
  if (!stat.isSocket() || stat.isSymbolicLink() || !inside(root, real)) {
    throw new FirecrackerApiError("FIRECRACKER_SOCKET_PATH_INVALID");
  }
}

function validateSpec(spec) {
  if (!spec || typeof spec !== "object") throw new TypeError("workspace spec is required");
  const id = spec.workspaceId;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new TypeError("workspaceId must be a UUID");
  }
  const template = spec.template;
  if (!template || typeof template !== "object" ||
      typeof template.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(template.id) ||
      !Number.isInteger(template.version) || template.version < 1 ||
      typeof template.imageDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(template.imageDigest) ||
      typeof template.bootArgs !== "string" || template.bootArgs.length < 1 || template.bootArgs.length > 256 ||
      !/^[A-Za-z0-9=,._: /-]+$/.test(template.bootArgs)) {
    throw new TypeError("template must be a server-owned, versioned and digest-pinned record");
  }
  const resources = spec.resources;
  if (!resources || !Number.isInteger(resources.cpuCount) || resources.cpuCount < 1 || resources.cpuCount > 4 ||
      !Number.isInteger(resources.memoryMiB) || resources.memoryMiB < 512 || resources.memoryMiB > 8192 ||
      resources.memoryMiB % 128 !== 0) {
    throw new TypeError("resource profile is outside the supported bounds");
  }
  const network = spec.network;
  if (!network || typeof network.tapDevice !== "string" || !/^tap[0-9a-f]{8}$/.test(network.tapDevice) ||
      typeof network.guestMac !== "string" || !/^02(?::[0-9a-f]{2}){5}$/i.test(network.guestMac) ||
      !Number.isInteger(network.guestCid) || network.guestCid < 3 || network.guestCid > 0xffffffff) {
    throw new TypeError("network allocation is invalid");
  }
  return { id, template, resources, network };
}

function putJson(socketPath, endpoint, payload, timeoutMs) {
  if (!ENDPOINTS.includes(endpoint)) throw new FirecrackerApiError("FIRECRACKER_ENDPOINT_NOT_ALLOWED");
  const body = Buffer.from(JSON.stringify(payload));
  return new Promise((resolvePromise, rejectPromise) => {
    const request = http.request({
      socketPath,
      path: endpoint,
      method: "PUT",
      headers: {
        host: "localhost",
        "content-type": "application/json",
        "content-length": body.length
      }
    }, (response) => {
      let responseBytes = 0;
      response.on("data", (chunk) => {
        responseBytes += chunk.length;
        if (responseBytes > 16_384) response.destroy();
      });
      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolvePromise();
        } else {
          rejectPromise(new FirecrackerApiError("FIRECRACKER_API_REJECTED", response.statusCode));
        }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("timeout")));
    request.on("error", () => rejectPromise(new FirecrackerApiError("FIRECRACKER_SOCKET_OR_REQUEST_FAILED")));
    request.end(body);
  });
}

/**
 * Talks to a Firecracker process through its per-VM Unix socket.
 * It never spawns processes, accepts shell commands, or exposes the API socket
 * over TCP. A trusted host supervisor must stage the jailed files, allocate
 * networking, and start Firecracker through the matching jailer binary first.
 */
export class FirecrackerApiClient {
  constructor({
    socketRoot = "/srv/jailer/firecracker",
    jailRootBase = "/srv/jailer/firecracker",
    timeoutMs = 3000
  } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10_000) {
      throw new TypeError("timeoutMs must be between 250 and 10000");
    }
    this.socketRoot = resolve(socketRoot);
    this.jailRootBase = resolve(jailRootBase);
    this.timeoutMs = timeoutMs;
  }

  async createWorkspace(spec) {
    const { id, template, resources, network } = validateSpec(spec);
    const jailRoot = resolve(this.jailRootBase, id, "root");
    if (!inside(this.jailRootBase, jailRoot)) throw new FirecrackerApiError("FIRECRACKER_JAIL_PATH_INVALID");

    const socketPath = resolve(this.socketRoot, id, "root", "run", "firecracker.socket");
    if (!inside(this.socketRoot, socketPath)) throw new FirecrackerApiError("FIRECRACKER_SOCKET_PATH_INVALID");

    const kernelPath = resolve(jailRoot, "kernel", "vmlinux");
    const rootfsPath = resolve(jailRoot, "rootfs.ext4");
    const workspacePath = resolve(jailRoot, "workspace.ext4");
    await assertRegularFile(jailRoot, kernelPath, "FIRECRACKER_KERNEL_IMAGE_INVALID");
    await assertRegularFile(jailRoot, rootfsPath, "FIRECRACKER_ROOTFS_IMAGE_INVALID");
    await assertRegularFile(jailRoot, workspacePath, "FIRECRACKER_WORKSPACE_DISK_INVALID");
    await assertUnixSocket(this.socketRoot, socketPath);

    const api = [
      ["/machine-config", {
        vcpu_count: resources.cpuCount,
        mem_size_mib: resources.memoryMiB,
        smt: false,
        track_dirty_pages: false
      }],
      ["/boot-source", {
        kernel_image_path: "/kernel/vmlinux",
        boot_args: template.bootArgs
      }],
      ["/drives/rootfs", {
        drive_id: "rootfs",
        path_on_host: "/rootfs.ext4",
        is_root_device: true,
        is_read_only: true
      }],
      ["/drives/workspace", {
        drive_id: "workspace",
        path_on_host: "/workspace.ext4",
        is_root_device: false,
        is_read_only: false
      }],
      ["/network-interfaces/eth0", {
        iface_id: "eth0",
        host_dev_name: network.tapDevice,
        guest_mac: network.guestMac.toLowerCase()
      }],
      ["/vsock", {
        guest_cid: network.guestCid,
        uds_path: "/run/cornod-vsock.sock"
      }],
      ["/actions", { action_type: "InstanceStart" }]
    ];

    for (const [endpoint, payload] of api) {
      await putJson(socketPath, endpoint, payload, this.timeoutMs);
    }
    return {
      workspaceId: id,
      templateId: template.id,
      templateVersion: template.version,
      imageDigest: template.imageDigest,
      state: "START_REQUESTED"
    };
  }
}
