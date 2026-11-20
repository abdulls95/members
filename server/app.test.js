import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "./app.js";

const config = {
  corsOrigins: new Set(["https://app.cornod.invalid"]),
  trustProxy: false
};
const pool = {
  async query() { return { rows: [{ "?column?": 1 }] }; },
  async connect() { throw new Error("Database should not be reached by this test"); }
};
const verifyAccessToken = async () => { throw new Error("Token verification should not be reached"); };

async function withServer(run) {
  const server = createApiServer({ config, pool, verifyAccessToken });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("liveness is public and does not touch the database", async () => {
  await withServer(async (base) => {
    const response = await fetch(base + "/health/live");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("API rejects requests without bearer authentication", async () => {
  await withServer(async (base) => {
    const response = await fetch(base + "/v1/me");
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "AUTH_REQUIRED");
  });
});

test("API rejects an unapproved browser origin", async () => {
  await withServer(async (base) => {
    const response = await fetch(base + "/health/live", { headers: { Origin: "https://evil.example" } });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "ORIGIN_DENIED");
  });
});
