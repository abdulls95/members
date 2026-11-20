import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
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
       email = COALESCE(EXCLUDED.email, public.users.email),
       display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
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
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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
      if (request.method !== "GET") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
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
        if (parts.length === 4 && parts[3] === "workspaces") {
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = decodeCursor(url.searchParams.get("cursor"));
          const data = await withTenant(pool, principal, tenantId, async (client) => {
            const values = [tenantId];
            let where = "tenant_id = $1";
            if (cursor) {
              values.push(cursor.time, cursor.id);
              where += " AND (created_at, id) < ($2::timestamptz, $3::uuid)";
            }
            values.push(limit + 1);
            const result = await client.query(
              `SELECT id, project_id, template_id, display_name, state, expires_at, created_at
               FROM public.workspaces WHERE ${where}
               ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
              values
            );
            const hasMore = result.rows.length > limit;
            const items = result.rows.slice(0, limit);
            const last = items.at(-1);
            return {
              items,
              nextCursor: hasMore && last ? encodeCursor({ time: last.created_at.toISOString(), id: last.id }) : null
            };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }

        if (parts.length === 4 && parts[3] === "projects") {
          const data = await withTenant(pool, principal, tenantId, async (client) => {
            const result = await client.query(
              "SELECT id, name, created_by, created_at, updated_at FROM public.projects WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100",
              [tenantId]
            );
            return { items: result.rows };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }

        if (parts.length === 4 && parts[3] === "audit-events") {
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = decodeCursor(url.searchParams.get("cursor"));
          const data = await withTenant(pool, principal, tenantId, async (client, user, role) => {
            requireRole(role, privilegedReadRoles);
            const values = [tenantId];
            let where = "tenant_id = $1";
            if (cursor) {
              values.push(cursor.time, cursor.id);
              where += " AND (occurred_at, id) < ($2::timestamptz, $3::bigint)";
            }
            values.push(limit + 1);
            const result = await client.query(
              `SELECT id, actor_id, action, target_type, target_id, outcome, request_id, policy_version, metadata, occurred_at
               FROM public.audit_events WHERE ${where}
               ORDER BY occurred_at DESC, id DESC LIMIT $${values.length}`,
              values
            );
            const hasMore = result.rows.length > limit;
            const items = result.rows.slice(0, limit);
            const last = items.at(-1);
            return {
              items,
              nextCursor: hasMore && last ? encodeCursor({ time: last.occurred_at.toISOString(), id: String(last.id) }) : null
            };
          });
          status = 200;
          json(response, status, { data, requestId });
          return;
        }

        if (parts.length === 4 && parts[3] === "usage") {
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
