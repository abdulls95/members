BEGIN;

-- Membership administration is intentionally read-only for the general runtime
-- role. A separately reviewed administrative procedure will be added before
-- invitations, role changes or revocations are exposed through the API.
DROP POLICY tenant_isolation ON public.memberships;

COMMIT;
