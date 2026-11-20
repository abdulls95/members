import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createTokenVerifier } from "./auth.js";
import { createApiServer } from "./app.js";
import { createPool } from "./db.js";
import { claimNextJob, completeJob, failJob, LeaseLostError, renewJobLease } from "./worker-queue.js";

const databaseUrl = process.env.API_TEST_DATABASE_URL;
const workerDatabaseUrl = process.env.API_TEST_WORKER_DATABASE_URL;
test("OIDC-authenticated API enforces tenant membership and role boundaries", { skip: !databaseUrl || !workerDatabaseUrl }, async (t) => {
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
  const workerPool = createPool({ databaseUrl: workerDatabaseUrl, databaseSsl: "disable" });
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
  async function post(path, jwt, idempotencyKey, body) {
    return fetch(base + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + jwt,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(body)
    });
  }

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    await workerPool.end();
    await new Promise((resolve) => jwksServer.close(resolve));
  });

  const ownerToken = await token("api-test-owner");
  const me = await get("/v1/me", ownerToken);
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.data.memberships.length, 2);
  assert.ok(meBody.data.memberships.some((membership) => membership.tenantId === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" && membership.role === "TENANT_OWNER"));
  assert.ok(meBody.data.memberships.some((membership) => membership.tenantId === "cccccccc-cccc-4ccc-8ccc-cccccccccccc" && membership.role === "TENANT_OWNER"));

  const workspaces = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/workspaces", ownerToken);
  assert.equal(workspaces.status, 200);
  const workspaceBody = await workspaces.json();
  assert.equal(workspaceBody.data.items.length, 2);
  assert.ok(workspaceBody.data.items.some((item) => item.display_name === "API Test Workspace"));

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
  assert.equal((await audit.json()).data.items.length, 2);
  const firstAuditPage = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/audit-events?limit=1", ownerToken);
  const firstAuditBody = await firstAuditPage.json();
  assert.equal(firstAuditBody.data.items.length, 1);
  assert.ok(firstAuditBody.data.nextCursor);
  const secondAuditPage = await get("/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/audit-events?limit=1&cursor=" + encodeURIComponent(firstAuditBody.data.nextCursor), ownerToken);
  const secondAuditBody = await secondAuditPage.json();
  assert.equal(secondAuditBody.data.items.length, 1);
  assert.notEqual(firstAuditBody.data.items[0].id, secondAuditBody.data.items[0].id);

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

  const tenantPath = "/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const ownerWorkspaceRequest = {
    templateId: "api-test-linux",
    displayName: "Queued Owner Workspace",
    resourceProfile: "starter",
    projectId: "aaaaaaaa-0000-4000-8000-000000000001"
  };
  const unsupportedCommand = await post(tenantPath + "/workspaces", ownerToken, "owner-unsupported-field-0001", {
    ...ownerWorkspaceRequest, command: "id"
  });
  assert.equal(unsupportedCommand.status, 400);

  const invalidMethod = await fetch(base + tenantPath + "/projects", {
    method: "POST",
    headers: { Authorization: "Bearer " + ownerToken, "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(invalidMethod.status, 404);

  const ownerCreate = await post(tenantPath + "/workspaces", ownerToken, "owner-create-workspace-0001", ownerWorkspaceRequest);
  assert.equal(ownerCreate.status, 202);
  const ownerCreateBody = await ownerCreate.json();
  assert.equal(ownerCreateBody.data.workspace.state, "REQUESTED");
  assert.equal(ownerCreateBody.data.job.state, "QUEUED");
  assert.equal(ownerCreateBody.data.replayed, false);

  const jobStatus = await get(tenantPath + "/workspace-jobs/" + ownerCreateBody.data.job.id, ownerToken);
  assert.equal(jobStatus.status, 200);
  assert.equal((await jobStatus.json()).data.job.state, "QUEUED");

  const ownerReplay = await post(tenantPath + "/workspaces", ownerToken, "owner-create-workspace-0001", ownerWorkspaceRequest);
  assert.equal(ownerReplay.status, 200);
  const ownerReplayBody = await ownerReplay.json();
  assert.equal(ownerReplayBody.data.replayed, true);
  assert.equal(ownerReplayBody.data.workspace.id, ownerCreateBody.data.workspace.id);

  const idempotencyConflict = await post(tenantPath + "/workspaces", ownerToken, "owner-create-workspace-0001", {
    ...ownerWorkspaceRequest, displayName: "Different Request"
  });
  assert.equal(idempotencyConflict.status, 409);

  const developerWorkspaceRequest = {
    templateId: "api-test-linux",
    displayName: "Developer Assigned Workspace",
    resourceProfile: "starter",
    projectId: "aaaaaaaa-0000-4000-8000-000000000001"
  };
  const developerCreate = await post(tenantPath + "/workspaces", developerToken, "developer-create-workspace-0001", developerWorkspaceRequest);
  assert.equal(developerCreate.status, 202);
  assert.equal((await developerCreate.json()).data.job.state, "QUEUED");

  const developerUnassignedProject = await post(tenantPath + "/workspaces", developerToken, "developer-create-workspace-0002", {
    ...developerWorkspaceRequest, displayName: "Forbidden Project Workspace", projectId: "aaaaaaaa-0000-4000-8000-000000000002"
  });
  assert.equal(developerUnassignedProject.status, 403);

  const quotaExceeded = await post(tenantPath + "/workspaces", ownerToken, "owner-create-workspace-0002", {
    ...ownerWorkspaceRequest, displayName: "Quota Overflow Workspace"
  });
  assert.equal(quotaExceeded.status, 429);

  // Concurrent requests must not both pass a one-workspace tenant quota.
  const concurrencyPath = "/v1/tenants/cccccccc-cccc-4ccc-8ccc-cccccccccccc/workspaces";
  const concurrentResults = await Promise.all([
    post(concurrencyPath, ownerToken, "concurrent-workspace-request-0001", {
      templateId: "api-test-linux", displayName: "Concurrent A", resourceProfile: "starter"
    }),
    post(concurrencyPath, ownerToken, "concurrent-workspace-request-0002", {
      templateId: "api-test-linux", displayName: "Concurrent B", resourceProfile: "starter"
    })
  ]);
  const concurrentStatuses = concurrentResults.map((response) => response.status).sort((a, b) => a - b);
  assert.deepEqual(concurrentStatuses, [202, 429]);

  // The isolated worker role can lease a job, but only its opaque lease token can mutate it.
  const lease = await claimNextJob(workerPool, { leaseSeconds: 60 });
  assert.ok(lease);
  assert.equal(lease.action, "CREATE");
  assert.equal(lease.attemptCount, 1);
  const renewedUntil = await renewJobLease(workerPool, lease, { leaseSeconds: 90 });
  assert.ok(new Date(renewedUntil).getTime() > Date.now());
  await assert.rejects(
    completeJob(workerPool, { jobId: lease.jobId, leaseToken: "A".repeat(43) }),
    (error) => error instanceof LeaseLostError
  );
  await workerPool.query(
    "UPDATE internal.workspace_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
    [lease.jobId]
  );
  const reclaimedLease = await claimNextJob(workerPool, { leaseSeconds: 60 });
  assert.ok(reclaimedLease);
  assert.equal(reclaimedLease.jobId, lease.jobId);
  assert.equal(reclaimedLease.attemptCount, 2);
  await assert.rejects(completeJob(workerPool, lease), (error) => error instanceof LeaseLostError);
  const completed = await completeJob(workerPool, reclaimedLease);
  assert.equal(completed.state, "SUCCEEDED");

  const retryLease = await claimNextJob(workerPool, { leaseSeconds: 60 });
  assert.ok(retryLease);
  const retry = await failJob(workerPool, retryLease, { errorCode: "TEST_TRANSIENT_FAILURE", retryBaseSeconds: 5 });
  assert.equal(retry.state, "QUEUED");
  assert.equal(retry.last_error_code, "TEST_TRANSIENT_FAILURE");
  assert.ok(new Date(retry.available_at).getTime() > Date.now());

  const wrongScope = await token("api-test-owner", "openid profile");
  const denied = await get("/v1/me", wrongScope);
  assert.equal(denied.status, 401);
});
