BEGIN;

-- A terminal ticket is a narrowly scoped credential. Tenant membership alone
-- must never make another user's ticket hash or attachment metadata readable.
DROP POLICY tenant_isolation ON public.terminal_tickets;
CREATE POLICY terminal_ticket_owner ON public.terminal_tickets
  USING (
    tenant_id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('cornod.user_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('cornod.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('cornod.user_id', true), '')::uuid
  );

COMMIT;
