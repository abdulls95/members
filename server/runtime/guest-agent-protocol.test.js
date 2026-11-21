import test from "node:test";
import assert from "node:assert/strict";
import { createSherlockToolRequest, parseAgentFrame } from "./guest-agent-protocol.js";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("creates a typed Sherlock request without command or path fields", () => {
  const request = createSherlockToolRequest({ workspaceId, requestId, username: "alice_01", sites: ["GitHub", "Reddit"] });
  assert.deepEqual(request, {
    type: "tool.run",
    protocolVersion: 1,
    workspaceId,
    requestId,
    toolId: "sherlock",
    args: { username: "alice_01", sites: ["GitHub", "Reddit"] }
  });
  assert.equal("command" in request, false);
  assert.equal("path" in request, false);
});

test("rejects shell-like values, arbitrary sites and duplicate sites", () => {
  assert.throws(() => createSherlockToolRequest({ workspaceId, requestId, username: "alice;id", sites: ["GitHub"] }));
  assert.throws(() => createSherlockToolRequest({ workspaceId, requestId, username: "alice", sites: ["GitHub", "GitHub"] }));
  assert.throws(() => createSherlockToolRequest({ workspaceId, requestId, username: "alice", sites: ["https://example.com"] }));
});

test("accepts a valid guest heartbeat and rejects unknown fields", () => {
  const heartbeat = { type: "agent.heartbeat", workspaceId, sequence: 1, uptimeSeconds: 5 };
  assert.deepEqual(parseAgentFrame(Buffer.from(JSON.stringify(heartbeat))), heartbeat);
  assert.throws(() => parseAgentFrame(JSON.stringify({ ...heartbeat, command: "id" })), /unsupported fields/i);
});

test("accepts only bounded result metadata under workspace results", () => {
  const result = {
    type: "tool.result",
    workspaceId,
    requestId,
    toolId: "sherlock",
    status: "succeeded",
    resultFile: "/workspace/results/alice.csv",
    bytesWritten: 120,
    sha256: "a".repeat(64)
  };
  assert.deepEqual(parseAgentFrame(JSON.stringify(result)), result);
  assert.throws(() => parseAgentFrame(JSON.stringify({ ...result, resultFile: "/etc/passwd" })));
  assert.throws(() => parseAgentFrame(JSON.stringify({ ...result, toolId: "shell" })));
});

test("rejects oversized, malformed and unsupported protocol frames", () => {
  assert.throws(() => parseAgentFrame("x".repeat(16_385)), /size/i);
  assert.throws(() => parseAgentFrame("{"));
  assert.throws(() => parseAgentFrame(JSON.stringify({ type: "command.exec", command: "id" })), /unsupported/i);
});
