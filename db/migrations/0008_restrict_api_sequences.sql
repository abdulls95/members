BEGIN;

-- Remove broad sequence access inherited from the initial schema. The API only
-- needs these two sequences for actor-attributed event and audit inserts.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM cornod_app;
GRANT USAGE, SELECT ON SEQUENCE public.workspace_events_id_seq, public.audit_events_id_seq TO cornod_app;

COMMIT;
