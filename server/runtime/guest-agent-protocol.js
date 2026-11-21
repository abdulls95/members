const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const SITE = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_FRAME_BYTES = 16_384;
const ERROR_CODES = new Set([
  "TOOL_NOT_AVAILABLE",
  "TOOL_INPUT_REJECTED",
  "TOOL_TIMEOUT",
  "TOOL_FAILED",
  "WORKSPACE_STORAGE_ERROR",
  "AGENT_INTERNAL_ERROR"
]);

function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function requireUuid(value, name) {
  if (typeof value !== "string" || !UUID.test(value)) throw new TypeError(name + " must be a UUID v4");
}

function requireInteger(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(name + " is outside the allowed range");
  }
}

function validateWorkspace(value) {
  requireUuid(value, "workspaceId");
}

function validateAgentMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new TypeError("Agent frame must be a JSON object");
  }

  if (message.type === "agent.hello") {
    if (!exactKeys(message, ["type", "protocolVersion", "workspaceId", "nonce"])) {
      throw new TypeError("agent.hello contains unsupported fields");
    }
    if (message.protocolVersion !== 1) throw new TypeError("Unsupported guest-agent protocol version");
    validateWorkspace(message.workspaceId);
    if (typeof message.nonce !== "string" || !/^[A-Za-z0-9_-]{22,128}$/.test(message.nonce)) {
      throw new TypeError("Invalid agent nonce");
    }
    return Object.freeze({ ...message });
  }

  if (message.type === "agent.heartbeat") {
    if (!exactKeys(message, ["type", "workspaceId", "sequence", "uptimeSeconds"])) {
      throw new TypeError("agent.heartbeat contains unsupported fields");
    }
    validateWorkspace(message.workspaceId);
    requireInteger(message.sequence, 1, 2_147_483_647, "sequence");
    requireInteger(message.uptimeSeconds, 0, 31_536_000, "uptimeSeconds");
    return Object.freeze({ ...message });
  }

  if (message.type === "tool.result") {
    if (!exactKeys(message, ["type", "workspaceId", "requestId", "toolId", "status", "resultFile", "bytesWritten", "sha256"])) {
      throw new TypeError("tool.result contains unsupported fields");
    }
    validateWorkspace(message.workspaceId);
    requireUuid(message.requestId, "requestId");
    if (message.toolId !== "sherlock") throw new TypeError("Unknown tool identifier");
    if (!["succeeded", "failed"].includes(message.status)) throw new TypeError("Invalid tool result status");
    if (typeof message.resultFile !== "string" || !/^\/workspace\/results\/[A-Za-z0-9_.-]{1,80}\.csv$/.test(message.resultFile)) {
      throw new TypeError("Result file must be a CSV inside the workspace results directory");
    }
    requireInteger(message.bytesWritten, 0, 5 * 1024 * 1024, "bytesWritten");
    if (typeof message.sha256 !== "string" || !SHA256.test(message.sha256)) throw new TypeError("Invalid result digest");
    return Object.freeze({ ...message });
  }

  if (message.type === "agent.error") {
    if (!exactKeys(message, ["type", "workspaceId", "requestId", "code"])) {
      throw new TypeError("agent.error contains unsupported fields");
    }
    validateWorkspace(message.workspaceId);
    requireUuid(message.requestId, "requestId");
    if (!SAFE_CODE.test(message.code) || !ERROR_CODES.has(message.code)) throw new TypeError("Unknown agent error code");
    return Object.freeze({ ...message });
  }

  throw new TypeError("Unsupported guest-agent message type");
}

/**
 * Parse one bounded JSON frame received over the VM's vsock channel.
 * Transport authentication, replay protection and workspace-to-VM binding
 * must be enforced by the host supervisor before this validator is called.
 */
export function parseAgentFrame(frame) {
  const bytes = Buffer.isBuffer(frame) ? frame : Buffer.from(String(frame), "utf8");
  if (bytes.length < 2 || bytes.length > MAX_FRAME_BYTES) throw new TypeError("Guest-agent frame size is invalid");
  let message;
  try {
    message = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new TypeError("Guest-agent frame is not valid JSON");
  }
  return validateAgentMessage(message);
}

/**
 * Construct the only tool execution request currently supported by the guest
 * protocol. The guest receives a tool ID and validated arguments, never a
 * command string, executable path, shell fragment or host filesystem path.
 */
export function createSherlockToolRequest({ workspaceId, requestId, username, sites }) {
  validateWorkspace(workspaceId);
  requireUuid(requestId, "requestId");
  if (typeof username !== "string" || !SITE.test(username)) throw new TypeError("Invalid Sherlock username");
  if (!Array.isArray(sites) || sites.length < 1 || sites.length > 5 ||
      sites.some((site) => typeof site !== "string" || !SITE.test(site)) ||
      new Set(sites).size !== sites.length) {
    throw new TypeError("Sherlock sites must contain one to five unique exact site names");
  }
  return Object.freeze({
    type: "tool.run",
    protocolVersion: 1,
    workspaceId,
    requestId,
    toolId: "sherlock",
    args: Object.freeze({ username, sites: Object.freeze([...sites]) })
  });
}
