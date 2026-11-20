import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createTokenVerifier } from "./auth.js";
import { createApiServer } from "./app.js";
import { createPool } from "./db.js";

const databaseUrl = process.env.API_TEST_DATABASE_URL;
test("OIDC-authenticated API enforces tenant membership and role boundaries", { skip: !databaseUrl }, async (t) => {
  const issuer = "https://identity.example.invalid";
  const audience = "cornod-api";
  const requiredScope = "cornod:api";
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "cornod-ci-key";
  jwk.alg = "RS256";
  jwk.use = "sig";

  const jwksServer = createHttpServer((request, response) => {
    if (request.url !== "/jwks.json") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" });
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
  const jwksPort = jwksServer.address().port;

  const config = {
    nodeEnv: "test",
    databaseUrl,
    databaseSsl: "disable",
    oidcIssuer: issuer,
    oidcAudience: audience,
    oidcJwksUrl: `http://127.0.0.1:${jwksPort}/jwks.json`,
    oidcRequiredScope: requiredScope,
    corsOrigins: new Set(["https://app.cornod.invalid"]),
    trustProxy: false
  };
  const pool = createPool(config);
  const verifyAccessToken = createTokenVerifier(config);
  const server = createApiServer({ config, pool, verifyAccessToken });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function token(subject, scope = requiredScope) {
    return new SignJWT({ scope, email: subject + "@example.invalid", name: subject })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  }
  async function get(path, jwt) {
    return fetch(base + path, { headers: { Authorization: "Bearer " + jwt } });
  }

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    await new Promise((resolve) => jwksServer.close(resolve));
  });

  const ownerToken = await token("api-test-owner");
  const me = await get("/v1/me", ownerToken);
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.data.memberships.length, 1);
  assert.equal(meBody.data.memberships[0].role, "TENANT_OWNER");

  const workspaces = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/workspaces", ownerToken);
  assert.equal(workspaces.status, 200);
  const workspaceBody = await workspaces.json();
  assert.equal(workspaceBody.data.items.length, 2);
  assert.equal(workspaceBody.data.items[0].display_name, "API Test Workspace");

  const firstPage = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/workspaces?limit=1", ownerToken);
  const firstPageBody = await firstPage.json();
  assert.equal(firstPageBody.data.items.length, 1);
  assert.ok(firstPageBody.data.nextCursor);
  const secondPage = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/workspaces?limit=1&cursor=" + encodeURIComponent(firstPageBody.data.nextCursor), ownerToken);
  const secondPageBody = await secondPage.json();
  assert.equal(secondPageBody.data.items.length, 1);
  assert.notEqual(firstPageBody.data.items[0].id, secondPageBody.data.items[0].id);

  const projects = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/projects", ownerToken);
  assert.equal((await projects.json()).data.items.length, 2);

  const audit = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/audit-events", ownerToken);
  assert.equal(audit.status, 200);
  assert.equal((await audit.json()).data.items.length, 1);

  const usage = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/usage", ownerToken);
  assert.equal(usage.status, 200);
  assert.equal((await usage.json()).data.totals[0].total, "12.50000000");

  const otherTenant = await get("/v1/tenants/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/workspaces", ownerToken);
  assert.equal(otherTenant.status, 404);

  const developerToken = await token("api-test-developer");
  const developerProjects = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/projects", developerToken);
  assert.equal((await developerProjects.json()).data.items.length, 1);
  const developerWorkspaces = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/workspaces", developerToken);
  assert.equal((await developerWorkspaces.json()).data.items.length, 1);
  const developerAudit = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/audit-events", developerToken);
  assert.equal(developerAudit.status, 403);

  const wrongScope = await token("api-test-owner", "openid profile");
  const denied = await get("/v1/me", wrongScope);
  assert.equal(denied.status, 401);
});
