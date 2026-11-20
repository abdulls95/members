import { createHash, randomBytes } from "node:crypto";
import { inTransaction } from "./db.js";
import { parseUuid } from "./policy.js";

export class LeaseLostError extends Error {
  constructor() {
    super("The job lease is missing, expired or no longer owned by this worker");
    this.name = "LeaseLostError";
    this.code = "JOB_LEASE_LOST";
  }
}

function boundedInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(name + " must be an integer between " + minimum + " and " + maximum);
  }
  return value;
}

function leaseHash(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new TypeError("A valid opaque lease token is required");
  }
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 32) throw new TypeError("A valid opaque lease token is required");
  return createHash("sha256").update(bytes).digest();
}

function validateLease(lease) {
  if (!lease || typeof lease !== "object") throw new TypeError("A job lease is required");
  return {
    jobId: parseUuid(lease.jobId),
    tokenHash: leaseHash(lease.leaseToken)
  };
}

/**
 * Claims one queued or expired job using SKIP LOCKED. The raw random token is
 * returned once; only its SHA-256 hash is stored in PostgreSQL.
 *
 * This module manages queue leases only. It does not execute commands or launch
 * workloads. A separately reviewed runtime adapter must do that work.
 */
export async function claimNextJob(pool, { leaseSeconds = 60 } = {}) {
  boundedInteger(leaseSeconds, 10, 120, "leaseSeconds");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(Buffer.from(token, "base64url")).digest();

  return inTransaction(pool, async (client) => {
    const result = await client.query(
      "SELECT * FROM internal.claim_next_workspace_job($1, $2)",
      [tokenHash, leaseSeconds]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return {
      jobId: row.id,
      tenantId: row.tenant_id,
      workspaceId: row.workspace_id,
      action: row.action,
      requestedBy: row.requested_by,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      leaseExpiresAt: row.lease_expires_at,
      leaseToken: token
    };
  });
}

export async function renewJobLease(pool, lease, { leaseSeconds = 60 } = {}) {
  boundedInteger(leaseSeconds, 10, 120, "leaseSeconds");
  const { jobId, tokenHash } = validateLease(lease);
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `UPDATE internal.workspace_jobs
       SET lease_expires_at = now() + make_interval(secs => $3),
           updated_at = now()
       WHERE id = $1
         AND state = 'LEASED'
         AND lease_token_hash = $2
         AND lease_expires_at > now()
       RETURNING lease_expires_at`,
      [jobId, tokenHash, leaseSeconds]
    );
    if (!result.rowCount) throw new LeaseLostError();
    return result.rows[0].lease_expires_at;
  });
}

export async function completeJob(pool, lease) {
  const { jobId, tokenHash } = validateLease(lease);
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `UPDATE internal.workspace_jobs
       SET state = 'SUCCEEDED',
           lease_expires_at = NULL,
           lease_token_hash = NULL,
           last_error_code = NULL,
           completed_at = now(),
           updated_at = now()
       WHERE id = $1
         AND state = 'LEASED'
         AND lease_token_hash = $2
         AND lease_expires_at > now()
       RETURNING id, state, attempt_count, completed_at`,
      [jobId, tokenHash]
    );
    if (!result.rowCount) throw new LeaseLostError();
    return result.rows[0];
  });
}

export async function failJob(pool, lease, { errorCode = "RUNTIME_FAILURE", retryBaseSeconds = 5 } = {}) {
  boundedInteger(retryBaseSeconds, 1, 300, "retryBaseSeconds");
  if (typeof errorCode !== "string" || !/^[A-Z][A-Z0-9_]{1,63}$/.test(errorCode)) {
    throw new TypeError("errorCode must be a short uppercase machine code");
  }
  const { jobId, tokenHash } = validateLease(lease);
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `UPDATE internal.workspace_jobs
       SET state = CASE WHEN attempt_count < max_attempts THEN 'QUEUED'::internal.workspace_job_state
                        ELSE 'FAILED'::internal.workspace_job_state END,
           available_at = CASE
             WHEN attempt_count < max_attempts
             THEN now() + make_interval(secs => LEAST($3 * power(2, LEAST(attempt_count - 1, 8))::integer, 300))
             ELSE available_at
           END,
           lease_expires_at = NULL,
           lease_token_hash = NULL,
           last_error_code = $4,
           completed_at = CASE WHEN attempt_count < max_attempts THEN NULL ELSE now() END,
           updated_at = now()
       WHERE id = $1
         AND state = 'LEASED'
         AND lease_token_hash = $2
         AND lease_expires_at > now()
       RETURNING id, state, attempt_count, available_at, completed_at, last_error_code`,
      [jobId, tokenHash, retryBaseSeconds, errorCode]
    );
    if (!result.rowCount) throw new LeaseLostError();
    return result.rows[0];
  });
}
