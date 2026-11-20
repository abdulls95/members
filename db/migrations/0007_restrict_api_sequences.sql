BEGIN;

-- The API can create actor-attributed events, but must not consume the
-- metering sequence or any unrelated sequence as a side effect.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM cornod_app;
GRANT USAGE, SELECT ON SEQUENCE public.workspace_events_id_seq, public.audit_events_id_seq TO cornod_app;

COMMIT;
