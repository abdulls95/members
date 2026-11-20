BEGIN;

CREATE TABLE public.resource_profiles (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{1,31}$'),
  cpu_millicores integer NOT NULL CHECK (cpu_millicores BETWEEN 250 AND 8000),
  memory_mb integer NOT NULL CHECK (memory_mb BETWEEN 256 AND 32768),
  storage_mb integer NOT NULL CHECK (storage_mb BETWEEN 512 AND 102400),
  max_ttl_minutes integer NOT NULL CHECK (max_ttl_minutes BETWEEN 5 AND 1440),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.resource_profiles (id, cpu_millicores, memory_mb, storage_mb, max_ttl_minutes, active)
VALUES
  ('starter', 1000, 1024, 2048, 60, true),
  ('standard', 2000, 4096, 10240, 120, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.workspaces
  ADD COLUMN resource_profile text NOT NULL DEFAULT 'starter'
  REFERENCES public.resource_profiles(id) ON DELETE RESTRICT;

CREATE TABLE public.tenant_quotas (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
  max_workspaces integer NOT NULL CHECK (max_workspaces BETWEEN 1 AND 1000),
  max_cpu_millicores integer NOT NULL CHECK (max_cpu_millicores BETWEEN 250 AND 100000),
  max_memory_mb integer NOT NULL CHECK (max_memory_mb BETWEEN 256 AND 1048576),
  max_storage_mb integer NOT NULL CHECK (max_storage_mb BETWEEN 512 AND 10485760),
  max_concurrent_jobs integer NOT NULL CHECK (max_concurrent_jobs BETWEEN 1 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_quotas FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_quota_self_read ON public.tenant_quotas
  FOR SELECT USING (
    tenant_id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid
  );

CREATE SCHEMA internal;
CREATE TYPE internal.workspace_job_action AS ENUM ('CREATE', 'START', 'STOP', 'RESTART', 'DELETE');
CREATE TYPE internal.workspace_job_state AS ENUM ('QUEUED', 'LEASED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE internal.workspace_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  action internal.workspace_job_action NOT NULL,
  state internal.workspace_job_state NOT NULL DEFAULT 'QUEUED',
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  requested_by uuid NOT NULL,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  lease_token_hash bytea,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, requested_by, idempotency_key),
  FOREIGN KEY (tenant_id, workspace_id) REFERENCES public.workspaces(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, requested_by) REFERENCES public.memberships(tenant_id, user_id) ON DELETE RESTRICT,
  CHECK (attempt_count <= max_attempts),
  CHECK (
    (state = 'LEASED' AND lease_expires_at IS NOT NULL AND lease_token_hash IS NOT NULL AND octet_length(lease_token_hash) = 32)
    OR
    (state <> 'LEASED' AND lease_expires_at IS NULL AND lease_token_hash IS NULL)
  )
);

CREATE INDEX workspace_jobs_claim_idx ON internal.workspace_jobs(state, available_at, created_at);
CREATE INDEX workspace_jobs_tenant_state_idx ON internal.workspace_jobs(tenant_id, state, created_at DESC);

ALTER TABLE internal.workspace_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.workspace_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_job_requester_or_worker ON internal.workspace_jobs
  USING (
    current_user = 'cornod_worker'
    OR (
      tenant_id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid
      AND requested_by = NULLIF(current_setting('cornod.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_user = 'cornod_worker'
    OR (
      tenant_id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid
      AND requested_by = NULLIF(current_setting('cornod.user_id', true), '')::uuid
    )
  );

GRANT SELECT ON public.resource_profiles, public.tenant_quotas TO cornod_app;
GRANT USAGE ON SCHEMA internal TO cornod_app, cornod_worker;
GRANT SELECT, INSERT ON internal.workspace_jobs TO cornod_app;
GRANT SELECT, UPDATE ON internal.workspace_jobs TO cornod_worker;
GRANT SELECT ON public.resource_profiles, public.workspace_templates TO cornod_worker;
GRANT SELECT, UPDATE ON public.workspaces TO cornod_worker;
GRANT SELECT, INSERT ON public.workspace_events TO cornod_worker;
GRANT USAGE, SELECT ON SEQUENCE public.workspace_events_id_seq TO cornod_worker;

COMMIT;
