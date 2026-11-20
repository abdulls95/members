BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.tenant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE public.member_role AS ENUM ('TENANT_OWNER', 'TENANT_ADMIN', 'OPERATOR', 'DEVELOPER', 'AUDITOR');
CREATE TYPE public.workspace_state AS ENUM ('REQUESTED', 'POLICY_CHECKED', 'PROVISIONING', 'READY', 'ACTIVE', 'TERMINATING', 'DESTROYED', 'REJECTED', 'QUARANTINED');
CREATE TYPE public.workspace_event_type AS ENUM ('CREATED', 'POLICY_APPROVED', 'PROVISIONING_STARTED', 'READY', 'STARTED', 'STOPPED', 'RESTARTED', 'TERMINATION_REQUESTED', 'DESTROYED', 'REJECTED', 'QUARANTINED');

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oidc_issuer text NOT NULL,
  oidc_subject text NOT NULL,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  status public.tenant_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  role public.member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.project_memberships (
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  role public.member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, project_id, user_id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES public.projects(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, user_id) REFERENCES public.memberships(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE public.workspace_templates (
  id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  description text NOT NULL,
  resource_profile text NOT NULL CHECK (resource_profile IN ('starter', 'standard')),
  image_digest text NOT NULL CHECK (image_digest ~ '^sha256:[a-f0-9]{64}$'),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  project_id uuid,
  template_id text NOT NULL,
  template_version integer NOT NULL,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 64),
  state public.workspace_state NOT NULL DEFAULT 'REQUESTED',
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES public.projects(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (template_id, template_version) REFERENCES public.workspace_templates(id, version) ON DELETE RESTRICT
);

CREATE TABLE public.workspace_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  event_type public.workspace_event_type NOT NULL,
  actor_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, workspace_id) REFERENCES public.workspaces(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE public.terminal_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ticket_hash bytea NOT NULL UNIQUE CHECK (octet_length(ticket_hash) = 32),
  audience text NOT NULL,
  origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, workspace_id) REFERENCES public.workspaces(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, user_id) REFERENCES public.memberships(tenant_id, user_id) ON DELETE RESTRICT,
  CHECK (expires_at <= created_at + interval '30 seconds')
);

CREATE TABLE public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  target_type text NOT NULL CHECK (length(target_type) BETWEEN 1 AND 80),
  target_id text,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILURE')),
  request_id text NOT NULL,
  policy_version text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usage_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  workspace_id uuid,
  metric text NOT NULL CHECK (length(metric) BETWEEN 1 AND 80),
  quantity numeric(24, 8) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL CHECK (length(unit) BETWEEN 1 AND 32),
  idempotency_key text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, workspace_id) REFERENCES public.workspaces(tenant_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX memberships_user_active_idx ON public.memberships(user_id, tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX projects_tenant_created_idx ON public.projects(tenant_id, created_at DESC);
CREATE INDEX workspaces_tenant_state_idx ON public.workspaces(tenant_id, state, created_at DESC);
CREATE INDEX workspaces_expiry_idx ON public.workspaces(expires_at) WHERE state NOT IN ('DESTROYED', 'REJECTED');
CREATE INDEX workspace_events_tenant_workspace_idx ON public.workspace_events(tenant_id, workspace_id, occurred_at DESC);
CREATE INDEX terminal_tickets_expiry_idx ON public.terminal_tickets(expires_at) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX audit_events_tenant_time_idx ON public.audit_events(tenant_id, occurred_at DESC);
CREATE INDEX usage_ledger_tenant_time_idx ON public.usage_ledger(tenant_id, recorded_at DESC);

-- Tenant context must be set by the trusted API inside every database transaction
-- after verifying the caller's identity and active membership. Never expose this DB
-- role or connection string to browsers or tenant workloads.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'memberships', 'projects', 'project_memberships',
    'workspaces', 'workspace_events', 'terminal_tickets',
    'audit_events', 'usage_ledger'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (tenant_id = NULLIF(current_setting(''cornod.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''cornod.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self_access ON public.tenants
  USING (id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
CREATE POLICY user_self_access ON public.users
  USING (id = NULLIF(current_setting('cornod.user_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('cornod.user_id', true), '')::uuid);
CREATE POLICY user_identity_lookup ON public.users
  USING (
    oidc_issuer = NULLIF(current_setting('cornod.oidc_issuer', true), '')
    AND oidc_subject = NULLIF(current_setting('cornod.oidc_subject', true), '')
  )
  WITH CHECK (
    oidc_issuer = NULLIF(current_setting('cornod.oidc_issuer', true), '')
    AND oidc_subject = NULLIF(current_setting('cornod.oidc_subject', true), '')
  );

CREATE POLICY membership_self_read ON public.memberships
  FOR SELECT USING (
    user_id = NULLIF(current_setting('cornod.user_id', true), '')::uuid
    AND revoked_at IS NULL
  );

ALTER TABLE public.workspace_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY active_template_catalog_read ON public.workspace_templates
  FOR SELECT USING (active = true);

-- The app role is provisioned separately with NOSUPERUSER, NOBYPASSRLS and no ownership.
GRANT USAGE ON SCHEMA public TO cornod_app;
GRANT SELECT, INSERT, UPDATE ON public.users TO cornod_app;
GRANT SELECT, INSERT, UPDATE ON public.tenants TO cornod_app;
GRANT SELECT ON public.memberships TO cornod_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO cornod_app;
GRANT SELECT ON public.project_memberships TO cornod_app;
GRANT SELECT ON public.workspace_templates TO cornod_app;
GRANT SELECT, INSERT ON public.workspaces TO cornod_app;
GRANT SELECT, INSERT ON public.workspace_events TO cornod_app;
GRANT SELECT, INSERT ON public.terminal_tickets TO cornod_app;
GRANT UPDATE (consumed_at, revoked_at) ON public.terminal_tickets TO cornod_app;
GRANT SELECT, INSERT ON public.audit_events TO cornod_app;
GRANT SELECT, INSERT ON public.usage_ledger TO cornod_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cornod_app;

COMMIT;
