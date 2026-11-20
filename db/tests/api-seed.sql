INSERT INTO public.users (id, oidc_issuer, oidc_subject, email, display_name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'https://identity.example.invalid', 'api-test-owner', 'owner@example.invalid', 'API Test Owner'),
  ('30000000-0000-4000-8000-000000000003', 'https://identity.example.invalid', 'api-test-developer', 'developer@example.invalid', 'API Test Developer');
INSERT INTO public.tenants (id, slug, display_name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'api-test-tenant', 'API Test Tenant'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'api-other-tenant', 'Other Tenant');
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'TENANT_OWNER'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000003', 'DEVELOPER');
INSERT INTO public.projects (id, tenant_id, name, created_by) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'API Test Project', '10000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_templates (id, version, description, resource_profile, image_digest, active)
VALUES ('api-test-linux', 1, 'CI test template', 'starter', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', true);
INSERT INTO public.workspaces (id, tenant_id, project_id, template_id, template_version, display_name, created_by, expires_at)
VALUES ('aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000001', 'api-test-linux', 1, 'API Test Workspace', '10000000-0000-4000-8000-000000000001', now() + interval '1 hour');
INSERT INTO public.audit_events (tenant_id, actor_id, action, target_type, target_id, outcome, request_id, policy_version)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'workspace.read', 'workspace', 'aaaaaaaa-1111-4111-8111-111111111111', 'SUCCESS', 'api-test-request', 'test-v1');
INSERT INTO public.usage_ledger (tenant_id, workspace_id, metric, quantity, unit, idempotency_key)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-111111111111', 'cpu_seconds', 12.5, 'seconds', 'api-test-usage-1');
