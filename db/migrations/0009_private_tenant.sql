-- Create the private CORNOD tenant and a conservative limit configuration.
-- No owner user, public registration, executable template or active worker is created.
INSERT INTO public.tenants (slug, display_name, status)
VALUES ('cornod-private', 'CORNOD Private', 'ACTIVE')
ON CONFLICT (slug) DO UPDATE SET display_name=EXCLUDED.display_name
WHERE public.tenants.display_name <> EXCLUDED.display_name;

INSERT INTO public.tenant_quotas
 (tenant_id, max_workspaces, max_cpu_millicores, max_memory_mb, max_storage_mb, max_concurrent_jobs)
SELECT id, 2, 2000, 2048, 4096, 1 FROM public.tenants WHERE slug='cornod-private'
ON CONFLICT (tenant_id) DO NOTHING;

-- Deliberately leave the workload template catalogue empty until KVM security acceptance.
