BEGIN;

-- Project assignments are private to the assigned user for the general API role.
-- Assignment management remains disabled until a separately reviewed admin path exists.
DROP POLICY tenant_isolation ON public.project_memberships;
CREATE POLICY project_membership_self_read ON public.project_memberships
  FOR SELECT USING (user_id = NULLIF(current_setting('cornod.user_id', true), '')::uuid);

COMMIT;
