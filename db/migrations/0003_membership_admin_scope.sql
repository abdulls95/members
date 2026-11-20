BEGIN;

-- Ordinary members may read only their own active membership rows.
-- Tenant administration writes require an explicit transaction-local context
-- set by the trusted API only after checking TENANT_OWNER/TENANT_ADMIN.
DROP POLICY tenant_isolation ON public.memberships;
CREATE POLICY membership_admin_manage ON public.memberships
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid
    AND current_setting('cornod.membership_manage', true) = 'true'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid
    AND current_setting('cornod.membership_manage', true) = 'true'
  );

COMMIT;
