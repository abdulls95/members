-- Run after migrations as a database administrator. The app role must not bypass RLS.
INSERT INTO public.users (id, oidc_issuer, oidc_subject, email) VALUES
  ('10000000-0000-4000-8000-000000000001', 'https://issuer.example.invalid', 'user-a', 'a@example.invalid'),
  ('20000000-0000-4000-8000-000000000002', 'https://issuer.example.invalid', 'user-b', 'b@example.invalid'),
  ('30000000-0000-4000-8000-000000000003', 'https://issuer.example.invalid', 'user-c', 'c@example.invalid');
INSERT INTO public.tenants (id, slug, display_name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'tenant-alpha', 'Tenant Alpha'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tenant-bravo', 'Tenant Bravo');
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'TENANT_OWNER'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000002', 'TENANT_OWNER'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000003', 'DEVELOPER');
INSERT INTO public.projects (id, tenant_id, name, created_by) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alpha project', '10000000-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bravo project', '20000000-0000-4000-8000-000000000002');
INSERT INTO public.project_memberships (tenant_id, project_id, user_id, role)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'DEVELOPER');
INSERT INTO public.workspace_templates (id, version, description, resource_profile, image_digest, active)
VALUES ('linux-base', 1, 'Pinned test template', 'starter', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', true);
INSERT INTO public.workspaces (id, tenant_id, project_id, template_id, template_version, display_name, created_by, expires_at) VALUES
  ('aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000001', 'linux-base', 1, 'Alpha workspace', '10000000-0000-4000-8000-000000000001', now() + interval '1 hour'),
  ('bbbbbbbb-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-4000-8000-000000000002', 'linux-base', 1, 'Bravo workspace', '20000000-0000-4000-8000-000000000002', now() + interval '1 hour');
INSERT INTO internal.workspace_jobs (tenant_id, workspace_id, action, state, idempotency_key, request_hash, requested_by) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-111111111111', 'CREATE', 'QUEUED', 'alpha-owner-job-key-0001', repeat('a', 64), '10000000-0000-4000-8000-000000000001'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-111111111111', 'CREATE', 'QUEUED', 'alpha-developer-job-key-01', repeat('b', 64), '30000000-0000-4000-8000-000000000003');
INSERT INTO public.terminal_tickets (tenant_id, workspace_id, user_id, ticket_hash, audience, origin, expires_at) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', decode(repeat('a1', 32), 'hex'), 'terminal-gateway', 'https://cornod.example.invalid', now() + interval '20 seconds'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000003', decode(repeat('b2', 32), 'hex'), 'terminal-gateway', 'https://cornod.example.invalid', now() + interval '20 seconds');
INSERT INTO public.audit_events (tenant_id, actor_id, action, target_type, outcome, request_id, policy_version)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'test.seed', 'tenant', 'SUCCESS', 'test-request-a', 'test-v1'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000002', 'test.seed', 'tenant', 'SUCCESS', 'test-request-b', 'test-v1');

SET ROLE cornod_app;
BEGIN;
SET LOCAL cornod.user_id = '10000000-0000-4000-8000-000000000001';
SET LOCAL cornod.tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.tenants) <> 1 THEN RAISE EXCEPTION 'tenant isolation failed'; END IF;
  IF (SELECT count(*) FROM public.memberships) <> 1 THEN RAISE EXCEPTION 'membership isolation failed'; END IF;
  IF (SELECT count(*) FROM public.projects) <> 1 THEN RAISE EXCEPTION 'project isolation failed'; END IF;
  IF (SELECT count(*) FROM public.project_memberships) <> 0 THEN RAISE EXCEPTION 'project membership self-scope failed'; END IF;
  IF (SELECT count(*) FROM public.workspaces) <> 1 THEN RAISE EXCEPTION 'workspace isolation failed'; END IF;
  IF (SELECT count(*) FROM public.audit_events) <> 1 THEN RAISE EXCEPTION 'audit isolation failed'; END IF;
  IF (SELECT count(*) FROM public.users) <> 1 THEN RAISE EXCEPTION 'user self-access failed'; END IF;
  IF (SELECT count(*) FROM public.terminal_tickets) <> 1 THEN RAISE EXCEPTION 'terminal ticket owner isolation failed'; END IF;
  IF (SELECT count(*) FROM internal.workspace_jobs) <> 1 THEN RAISE EXCEPTION 'workspace job requester isolation failed'; END IF;
  IF has_table_privilege('cornod_app', 'internal.workspace_jobs', 'UPDATE') THEN RAISE EXCEPTION 'runtime app role can update jobs'; END IF;
  IF (SELECT count(*) FROM public.workspace_templates WHERE id = 'linux-base') <> 1 THEN RAISE EXCEPTION 'approved template catalog read failed'; END IF;
  IF has_table_privilege('cornod_app', 'public.memberships', 'UPDATE')
     OR has_table_privilege('cornod_app', 'public.memberships', 'INSERT')
     OR has_table_privilege('cornod_app', 'public.memberships', 'DELETE') THEN
    RAISE EXCEPTION 'runtime role has unexpected membership write privileges';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.projects (tenant_id, name, created_by)
    VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cross-tenant attempt', '10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'cross-tenant insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.audit_events SET action = 'tampered' WHERE request_id = 'test-request-a';
    RAISE EXCEPTION 'audit mutation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.usage_ledger;
    RAISE EXCEPTION 'usage ledger deletion unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF has_table_privilege('cornod_app', 'public.usage_ledger', 'INSERT') THEN
    RAISE EXCEPTION 'API role can forge usage records';
  END IF;
  BEGIN
    INSERT INTO public.workspace_events (tenant_id, workspace_id, event_type, actor_id, request_id)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-111111111111', 'CREATED', '30000000-0000-4000-8000-000000000003', 'spoofed-event');
    RAISE EXCEPTION 'workspace event actor spoof unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.audit_events (tenant_id, actor_id, action, target_type, outcome, request_id, policy_version)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000003', 'spoofed', 'workspace', 'SUCCESS', 'spoofed-audit', 'test-v1');
    RAISE EXCEPTION 'audit actor spoof unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.workspaces (tenant_id, project_id, template_id, template_version, display_name, created_by, expires_at)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000001', 'linux-base', 1, 'Spoofed creator', '30000000-0000-4000-8000-000000000003', now() + interval '1 hour');
    RAISE EXCEPTION 'workspace creator spoof unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

ROLLBACK;
RESET ROLE;

SET ROLE cornod_worker;
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM internal.workspace_jobs) <> 2 THEN
    RAISE EXCEPTION 'worker cannot see the full job queue';
  END IF;
  UPDATE internal.workspace_jobs SET state = 'CANCELLED', updated_at = now()
  WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND requested_by = '30000000-0000-4000-8000-000000000003';
  IF NOT FOUND THEN RAISE EXCEPTION 'worker cannot update a claimed job'; END IF;
END $$;
ROLLBACK;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = 'cornod_app') THEN
    RAISE EXCEPTION 'cornod_app must not bypass row-level security';
  END IF;
  IF (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = 'cornod_worker') THEN
    RAISE EXCEPTION 'cornod_worker must not bypass row-level security';
  END IF;
  IF NOT has_column_privilege('cornod_worker', 'internal.workspace_jobs', 'state', 'UPDATE')
     OR has_column_privilege('cornod_worker', 'internal.workspace_jobs', 'request_hash', 'UPDATE')
     OR has_column_privilege('cornod_worker', 'public.workspaces', 'display_name', 'UPDATE')
     OR NOT has_column_privilege('cornod_worker', 'public.workspaces', 'state', 'UPDATE') THEN
    RAISE EXCEPTION 'worker column privileges are not sufficiently restricted';
  END IF;
END $$;

SELECT 'CORNOD database isolation smoke tests passed' AS result;
