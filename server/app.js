import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { inTransaction } from "./db.js";
import { decodeCursor, encodeCursor, HttpError, parseLimit, parseUuid, requireRole } from "./policy.js";

const privilegedReadRoles = ["TENANT_OWNER", "TENANT_ADMIN", "AUDITOR"];

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("Cache-Control", "no-store");
}

function createRateLimiter(maxRequests = 120, windowMs = 60_000) {
  const buckets = new Map();
  return function allow(key) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      bucket = { startedAt: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 10_000) {
      for (const [id, item] of buckets) if (now - item.startedAt >= windowMs) buckets.delete(id);
    }
    return bucket.count <= maxRequests;
  };
}

async function resolveUser(client, principal) {
  await client.query("SELECT set_config('cornod.oidc_issuer', $1, true)", [principal.issuer]);
  await client.query("SELECT set_config('cornod.oidc_subject', $1, true)", [principal.subject]);
  const result = await client.query(
    `INSERT INTO public.users (oidc_issuer, oidc_subject, email, display_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (oidc_issuer, oidc_subject)
     DO UPDATE SET
       email = COALESCE(EXCLUDED.email, users.email),
       display_name = COALESCE(EXCLUDED.display_name, users.display_name),
       updated_at = now()
     RETURNING id, email, display_name`,
    [principal.issuer, principal.subject, principal.email, principal.displayName]
  );
  const user = result.rows[0];
  await client.query("SELECT set_config('cornod.user_id', $1, true)", [user.id]);
  return user;
}

async function withUser(pool, principal, work) {
  return inTransaction(pool, async (client) => {
    const user = await resolveUser(client, principal);
    return work(client, user);
  });
}

async function withTenant(pool, principal, tenantId, work) {
  return withUser(pool, principal, async (client, user) => {
    await client.query("SELECT set_config('cornod.tenant_id', $1, true)", [tenantId]);
    const membership = await client.query(
      "SELECT role FROM public.memberships WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL",
      [tenantId, user.id]
    );
    if (!membership.rowCount) throw new HttpError(404, "TENANT_NOT_FOUND", "Tenant not found");
    const tenant = await client.query("SELECT status FROM public.tenants WHERE id = $1", [tenantId]);
    if (!tenant.rowCount || tenant.rows[0].status !== "ACTIVE") {
      throw new HttpError(403, "TENANT_UNAVAILABLE", "Tenant is not available");
    }
    return work(client, user, membership.rows[0].role);
  });
}

function bearerToken(request) {
  const value = request.headers.authorization || "";
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(value);
  if (!match) throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required");
  return match[1];
}

async function readJson(request, maxBytes = 8192) {
  const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpError(415, "JSON_REQUIRED", "Content-Type must be application/json");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large");
    chunks.push(chunk);
  }
  if (!size) throw new HttpError(400, "EMPTY_BODY", "A JSON request body is required");
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "INVALID_BODY", "Request body must be a JSON object");
  }
  return body;
}

function normalizeWorkspaceRequest(body) {
  const allowed = new Set(["templateId", "displayName", "resourceProfile", "projectId"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new HttpError(400, "UNSUPPORTED_FIELD", "Request contains an unsupported field");
  }
  if (typeof body.templateId !== "string" || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(body.templateId)) {
    throw new HttpError(400, "INVALID_TEMPLATE", "An approved template identifier is required");
  }
  if (typeof body.displayName !== "string" || body.displayName.trim().length < 1 || body.displayName.trim().length > 64) {
    throw new HttpError(400, "INVALID_DISPLAY_NAME", "Workspace name must be between 1 and 64 characters");
  }
  if (!["starter", "standard"].includes(body.resourceProfile)) {
    throw new HttpError(400, "INVALID_RESOURCE_PROFILE", "An approved resource profile is required");
  }
  let projectId = null;
  if (body.projectId !== undefined && body.projectId !== null) projectId = parseUuid(body.projectId);
  return {
    templateId: body.templateId,
    displayName: body.displayName.trim(),
    resourceProfile: body.resourceProfile,
    projectId
  };
}

async function createWorkspaceRequest(client, user, role, tenantId, body, idempotencyKey, requestId) {
  requireRole(role, ["TENANT_OWNER", "TENANT_ADMIN", "OPERATOR", "DEVELOPER"]);
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._~-]{16,128}$/.test(idempotencyKey)) {
    throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
  }

  const input = normalizeWorkspaceRequest(body);
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  // One tenant-scoped lock protects both idempotency replay and quota accounting.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [tenantId]);

  const existing = await client.query(
    `SELECT j.id AS job_id, j.request_hash, j.state AS job_state,
            w.id AS workspace_id, w.display_name, w.state AS workspace_state,
            w.template_id, w.resource_profile, w.expires_at
     FROM internal.workspace_jobs j
     JOIN public.workspaces w ON w.tenant_id = j.tenant_id AND w.id = j.workspace_id
     WHERE j.tenant_id = $1 AND j.requested_by = $2 AND j.idempotency_key = $3`,
    [tenantId, user.id, idempotencyKey]
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    if (row.request_hash !== requestHash) {
      throw new HttpError(409, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for a different request");
    }
    return {
      replayed: true,
      workspace: {
        id: row.workspace_id, displayName: row.display_name, state: row.workspace_state,
        templateId: row.template_id, resourceProfile: row.resource_profile, expiresAt: row.expires_at
      },
      job: { id: row.job_id, state: row.job_state, action: "CREATE" }
    };
  }

  const template = await client.query(
    "SELECT id, version FROM public.workspace_templates WHERE id = $1 AND resource_profile = $2 AND active = true ORDER BY version DESC LIMIT 1",
    [input.templateId, input.resourceProfile]
  );
  if (!template.rowCount) throw new HttpError(400, "TEMPLATE_NOT_AVAILABLE", "The requested template is not active for this resource profile");

  const profile = await client.query(
    "SELECT id, cpu_millicores, memory_mb, storage_mb, max_ttl_minutes FROM public.resource_profiles WHERE id = $1 AND active = true",
    [input.resourceProfile]
  );
  if (!profile.rowCount) throw new HttpError(400, "RESOURCE_PROFILE_NOT_AVAILABLE", "The requested resource profile is not active");

  if (input.projectId) {
    const project = await client.query(
      "SELECT id FROM public.projects WHERE tenant_id = $1 AND id = $2",
      [tenantId, input.projectId]
    );
    if (!project.rowCount) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found");
    if (["OPERATOR", "DEVELOPER"].includes(role)) {
      const assignment = await client.query(
        "SELECT 1 FROM public.project_memberships WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3",
        [tenantId, input.projectId, user.id]
      );
      if (!assignment.rowCount) throw new HttpError(403, "PROJECT_ACCESS_DENIED", "You are not assigned to this project");
    }
  }

  const quota = await client.query(
    "SELECT max_workspaces, max_cpu_millicores, max_memory_mb, max_storage_mb, max_concurrent_jobs FROM public.tenant_quotas WHERE tenant_id = $1",
    [tenantId]
  );
  if (!quota.rowCount) throw new HttpError(503, "QUOTA_NOT_CONFIGURED", "Workspace quota is not configured for this tenant");

  const usage = await client.query(
    `SELECT count(*)::integer AS workspace_count,
            COALESCE(sum(rp.cpu_millicores), 0)::integer AS cpu_millicores,
            COALESCE(sum(rp.memory_mb), 0)::integer AS memory_mb,
            COALESCE(sum(rp.storage_mb), 0)::integer AS storage_mb
     FROM public.workspaces w
     JOIN public.resource_profiles rp ON rp.id = w.resource_profile
     WHERE w.tenant_id = $1 AND w.state NOT IN ('DESTROYED', 'REJECTED') AND w.expires_at > now()`,
    [tenantId]
  );
  const pending = await client.query(
    "SELECT count(*)::integer AS pending_count FROM public.workspaces WHERE tenant_id = $1 AND state IN ('REQUESTED', 'POLICY_CHECKED', 'PROVISIONING')",
    [tenantId]
  );
  const q = quota.rows[0];
  const u = usage.rows[0];
  const p = profile.rows[0];
  if (
    u.workspace_count + 1 > q.max_workspaces ||
    u.cpu_millicores + p.cpu_millicores > q.max_cpu_millicores ||
    u.memory_mb + p.memory_mb > q.max_memory_mb ||
    u.storage_mb + p.storage_mb > q.max_storage_mb ||
    pending.rows[0].pending_count + 1 > q.max_concurrent_jobs
  ) {
    throw new HttpError(429, "WORKSPACE_QUOTA_EXCEEDED", "Workspace quota has been reached");
  }

  const workspaceResult = await client.query(
    `INSERT INTO public.workspaces
       (tenant_id, project_id, template_id, template_version, display_name, state, created_by, expires_at, resource_profile)
     VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6, now() + make_interval(mins => $7), $8)
     RETURNING id, display_name, state, template_id, resource_profile, expires_at`,
    [tenantId, input.projectId, template.rows[0].id, template.rows[0].version, input.displayName, user.id, p.max_ttl_minutes, p.id]
  );
  const workspace = workspaceResult.rows[0];
  const jobResult = await client.query(
    `INSERT INTO internal.workspace_jobs
       (tenant_id, workspace_id, action, state, idempotency_key, request_hash, requested_by)
     VALUES ($1, $2, 'CREATE', 'QUEUED', $3, $4, $5)
     RETURNING id, state, action`,
    [tenantId, workspace.id, idempotencyKey, requestHash, user.id]
  );
  const job = jobResult.rows[0];

  await client.query(
    `INSERT INTO public.workspace_events (tenant_id, workspace_id, event_type, actor_id, request_id, details)
     VALUES ($1, $2, 'CREATED', $3, $4, jsonb_build_object('jobId', $5::text, 'resourceProfile', $6::text))`,
    [tenantId, workspace.id, user.id, requestId, job.id, p.id]
  );
  await client.query(
    `INSERT INTO public.audit_events (tenant_id, actor_id, action, target_type, target_id, outcome, request_id, policy_version, metadata)
     VALUES ($1, $2, 'workspace.create.requested', 'workspace', $3, 'SUCCESS', $4, 'v1', jsonb_build_object('jobId', $5::text, 'resourceProfile', $6::text))`,
    [tenantId, user.id, workspace.id, requestId, job.id, p.id]
  );

  return {
    replayed: false,
    workspace: {
      id: workspace.id, displayName: workspace.display_name, state: workspace.state,
      templateId: workspace.template_id, resourceProfile: workspace.resource_profile, expiresAt: workspace.expires_at
    },
    job: { id: job.id, state: job.state, action: job.action }
  };
}

export function createApiServer({ config, pool, verifyAccessToken, rateLimit = createRateLimiter() }) {
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const started = Date.now();
    setSecurityHeaders(response);
    response.setHeader("X-Request-Id", requestId);

    const origin = request.headers.origin;
    if (origin) {
      if (!config.corsOrigins.has(origin)) {
        json(response, 403, { error: { code: "ORIGIN_DENIED", message: "Origin is not allowed" }, requestId });
        return;
      }
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Max-Age", "600");
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const remote = config.trustProxy
      ? String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "").split(",")[0].trim()
      : String(request.socket.remoteAddress || "unknown");
    if (!rateLimit(remote)) {
      json(response, 429, { error: { code: "RATE_LIMITED", message: "Too many requests" }, requestId });
      return;
    }

    let status = 500;
    try {
      const url = new URL(request.url || "/", "http://api.local");
      const parts = url.pathname.split("/").filter(Boolean);

      if (request.method === "GET" && url.pathname === "/health/live") {
        status = 200;
        json(response, status, { status: "ok", requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/health/ready") {
        await pool.query("SELECT 1");
        status = 200;
        json(response, status, { status: "ready", requestId });
        return;
      }
      if (request.method !== "GET" && request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
      if (parts[0] !== "v1") throw new HttpError(404, "NOT_FOUND", "Route not found");

      const token = bearerToken(request);
      let principal;
      try {
        principal = await verifyAccessToken(token);
      } catch {
        throw new HttpError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
      }

      if (parts.length === 2 && parts[1] === "me") {
        const data = await withUser(pool, principal, async (client, user) => {
          const memberships = await client.query(
            "SELECT tenant_id, role, created_at FROM public.memberships WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at",
            [user.id]
          );
          return {
            user: { id: user.id, email: user.email, displayName: user.display_name },
            memberships: memberships.rows.map((row) => ({
              tenantId: row.tenant_id,
              role: row.role,
              joinedAt: row.created_at
            }))
          };
        });
        status = 200;
        json(response, status, { data, requestId });
        return;
      }

      if (parts.length >= 3 && parts[1] === "tenants") {
        const tenantId = parseUuid(parts[2]);
        if (parts.length === 4 && parts[3] === "workspaces" && request.method === "POST") {
          const body = await readJson(request);
          const idempotencyKey = request.headers["idempotency-key"];
          const result = await withTenant(pool, principal, tenantId, (client, user, role) =>
            createWorkspaceRequest(client, user, role, tenantId, body, idempotencyKey, requestId)
          );
          status = result.replayed ? 200 : 202;
          json(response, status, { data: result, requestId });
          return;
        }

        if (parts.length === 5 && parts[3] === "workspace-jobs" && request.method === "GET") {
          const jobId = parseUuid(parts[4]);
          const data = await withTenant(pool, principal, tenantId, async (client, user) => {
            const result = await client.query(
              `SELECT j.id, j.action, j.state, j.attempt_count, j.created_at, j.updated_at,
                      w.id AS workspace_id, w.display_name, w.state AS workspace_state
               FROM internal.workspace_jobs j
               JOIN public.workspaces w ON w.tenant_id = j.tenant_id AND w.id = j.workspace_id
               WHERE j.tenant_id = $1 AND j.requested_by = $2 AND j.id = $3`,
              [tenantId, user.id, jobId]
            );
            if (!result.rowCount) throw new HttpError(404, "JOB_NOT_FOUND", "Workspace job not found");
            return { job: result.rows[0] };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }

        if (parts.length === 4 && parts[3] === "workspaces" && request.method === "GET") {
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = decodeCursor(url.searchParams.get("cursor"));
          const data = await withTenant(pool, principal, tenantId, async (client, user, role) => {
            const tenantWide = ["TENANT_OWNER", "TENANT_ADMIN", "AUDITOR"].includes(role);
            const values = [tenantId, tenantWide, user.id];
            let where = "tenant_id = $1 AND ($2::boolean OR created_by = $3 OR project_id IN (SELECT project_id FROM public.project_memberships WHERE tenant_id = $1 AND user_id = $3))";
            if (cursor) {
              values.push(cursor.time, cursor.id);
              where += " AND (floor(extract(epoch from created_at) * 1000000)::bigint, id) < ($4::bigint, $5::uuid)";
            }
            values.push(limit + 1);
            const result = await client.query(
              `SELECT id, project_id, template_id, display_name, state, expires_at, created_at,
                     floor(extract(epoch from created_at) * 1000000)::bigint::text AS cursor_time
               FROM public.workspaces WHERE ${where}
               ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
              values
            );
            const hasMore = result.rows.length > limit;
            const pageRows = result.rows.slice(0, limit);
            const items = pageRows.map(({ cursor_time, ...row }) => row);
            const last = pageRows.at(-1);
            return {
              items,
              nextCursor: hasMore && last ? encodeCursor({ time: last.cursor_time, id: last.id }) : null
            };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }

        if (parts.length === 4 && parts[3] === "projects" && request.method === "GET") {
          const data = await withTenant(pool, principal, tenantId, async (client, user, role) => {
            const tenantWide = ["TENANT_OWNER", "TENANT_ADMIN", "AUDITOR"].includes(role);
            const result = await client.query(
              `SELECT id, name, created_by, created_at, updated_at
               FROM public.projects
               WHERE tenant_id = $1
                 AND ($2::boolean OR id IN (
                   SELECT project_id FROM public.project_memberships
                   WHERE tenant_id = $1 AND user_id = $3
                 ))
               ORDER BY created_at DESC LIMIT 100`,
              [tenantId, tenantWide, user.id]
            );
            return { items: result.rows };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }

        if (parts.length === 4 && parts[3] === "audit-events" && request.method === "GET") {
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = decodeCursor(url.searchParams.get("cursor"));
          const data = await withTenant(pool, principal, tenantId, async (client, user, role) => {
            requireRole(role, privilegedReadRoles);
            const values = [tenantId];
            let where = "tenant_id = $1";
            if (cursor) {
              values.push(cursor.time, cursor.id);
              where += " AND (floor(extract(epoch from occurred_at) * 1000000)::bigint, id) < ($2::bigint, $3::bigint)";
            }
            values.push(limit + 1);
            const result = await client.query(
              `SELECT id, actor_id, action, target_type, target_id, outcome, request_id, policy_version, metadata, occurred_at,
                     floor(extract(epoch from occurred_at) * 1000000)::bigint::text AS cursor_time
               FROM public.audit_events WHERE ${where}
               ORDER BY occurred_at DESC, id DESC LIMIT $${values.length}`,
              values
            );
            const hasMore = result.rows.length > limit;
            const pageRows = result.rows.slice(0, limit);
            const items = pageRows.map(({ cursor_time, ...row }) => row);
            const last = pageRows.at(-1);
            return {
              items,
              nextCursor: hasMore && last ? encodeCursor({ time: last.cursor_time, id: String(last.id) }) : null
            };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }

        if (parts.length === 4 && parts[3] === "usage" && request.method === "GET") {
          const data = await withTenant(pool, principal, tenantId, async (client, user, role) => {
            requireRole(role, privilegedReadRoles);
            const result = await client.query(
              "SELECT metric, unit, sum(quantity)::text AS total FROM public.usage_ledger WHERE tenant_id = $1 GROUP BY metric, unit ORDER BY metric, unit",
              [tenantId]
            );
            return { totals: result.rows };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }
      }

      throw new HttpError(404, "NOT_FOUND", "Route not found");
    } catch (error) {
      status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR";
      const message = error instanceof HttpError ? error.message : "An unexpected error occurred";
      if (status === 500) {
        // Do not log tokens, query strings, database messages or personal claims.
        process.stderr.write(JSON.stringify({ requestId, code, method: request.method, status, durationMs: Date.now() - started }) + "\n");
      }
      if (!response.headersSent) json(response, status, { error: { code, message }, requestId });
      else response.destroy();
    }
  });
}
