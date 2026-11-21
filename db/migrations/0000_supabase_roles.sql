-- Provision only in a dedicated CORNOD Supabase project before 0001.
-- Database credentials are set separately by a secret manager.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cornod_app') THEN
    CREATE ROLE cornod_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cornod_worker') THEN
    CREATE ROLE cornod_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
REVOKE ALL ON SCHEMA public FROM cornod_app, cornod_worker;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
