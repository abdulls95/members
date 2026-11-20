import test from "node:test";
import assert from "node:assert/strict";
import { decodeCursor, encodeCursor, HttpError, parseLimit, parseUuid, requireRole } from "./policy.js";

test("UUID parser accepts valid UUIDs and rejects arbitrary identifiers", () => {
  assert.equal(parseUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.throws(() => parseUuid("../other-tenant"), (error) => error instanceof HttpError && error.status === 400);
});

test("pagination limits are bounded", () => {
  assert.equal(parseLimit(null), 25);
  assert.equal(parseLimit("100"), 100);
  assert.throws(() => parseLimit("101"), (error) => error.code === "INVALID_LIMIT");
  assert.throws(() => parseLimit("-1"), (error) => error.code === "INVALID_LIMIT");
});

test("cursor round trip and tamper rejection", () => {
  const cursor = encodeCursor({ time: "2026-11-20T12:00:00.000Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
  assert.deepEqual(decodeCursor(cursor), { time: "2026-11-20T12:00:00.000Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
  assert.deepEqual(decodeCursor(encodeCursor({ time: "1795204800123456", id: "42" })), { time: "1795204800123456", id: "42" });
  assert.throws(() => decodeCursor("not a cursor"), (error) => error.code === "INVALID_CURSOR");
});

test("privileged audit access is denied to developer role", () => {
  assert.throws(() => requireRole("DEVELOPER", ["TENANT_OWNER", "TENANT_ADMIN", "AUDITOR"]),
    (error) => error instanceof HttpError && error.status === 403);
  assert.doesNotThrow(() => requireRole("AUDITOR", ["TENANT_OWNER", "TENANT_ADMIN", "AUDITOR"]));
});
