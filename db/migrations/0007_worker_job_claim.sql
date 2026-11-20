BEGIN;

CREATE FUNCTION internal.claim_next_workspace_job(p_lease_token_hash bytea, p_lease_seconds integer DEFAULT 60)
RETURNS SETOF internal.workspace_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, internal
AS $function$
BEGIN
  IF current_user <> 'cornod_worker' THEN
    RAISE EXCEPTION 'worker role required' USING ERRCODE = '42501';
  END IF;
  IF p_lease_token_hash IS NULL OR octet_length(p_lease_token_hash) <> 32 THEN
    RAISE EXCEPTION 'lease token hash must be 32 bytes' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 10 OR p_lease_seconds > 120 THEN
    RAISE EXCEPTION 'lease duration must be between 10 and 120 seconds' USING ERRCODE = '22023';
  END IF;

  UPDATE internal.workspace_jobs
  SET state = 'FAILED',
      lease_expires_at = NULL,
      lease_token_hash = NULL,
      last_error_code = 'MAX_ATTEMPTS_EXCEEDED',
      completed_at = now(),
      updated_at = now()
  WHERE state = 'LEASED'
    AND lease_expires_at <= now()
    AND attempt_count >= max_attempts;

  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM internal.workspace_jobs
    WHERE (state = 'QUEUED' AND available_at <= now())
       OR (state = 'LEASED' AND lease_expires_at <= now() AND attempt_count < max_attempts)
    ORDER BY available_at, created_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE internal.workspace_jobs AS job
  SET state = 'LEASED',
      attempt_count = job.attempt_count + 1,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      lease_token_hash = p_lease_token_hash,
      last_error_code = NULL,
      updated_at = now()
  FROM candidate
  WHERE job.id = candidate.id
  RETURNING job.*;
END;
$function$;

REVOKE ALL ON FUNCTION internal.claim_next_workspace_job(bytea, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.claim_next_workspace_job(bytea, integer) FROM cornod_app;
GRANT EXECUTE ON FUNCTION internal.claim_next_workspace_job(bytea, integer) TO cornod_worker;

COMMIT;
