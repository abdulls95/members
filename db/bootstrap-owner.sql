-- One-time CORNOD owner bootstrap, deliberately NOT an automatic migration.
-- Run only as a trusted migration operator AFTER verifying the exact Supabase Auth user ID.
-- Usage: psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v owner_auth_uuid='verified-uuid' -f db/bootstrap-owner.sql
-- This is never called through the Data API, and no public function is created.
BEGIN;

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug='cornod-private') THEN
   RAISE EXCEPTION 'CORNOD private tenant is missing';
 END IF;
END $$;

CREATE TEMP TABLE cornod_verified_owner (id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO cornod_verified_owner (id)
SELECT id FROM auth.users
WHERE id = :'owner_auth_uuid'::uuid
  AND email_confirmed_at IS NOT NULL
  AND deleted_at IS NULL;
-- Fail rather than silently creating a membership for a missing/unverified identity.
DO $$
BEGIN
  IF (SELECT count(*) FROM cornod_verified_owner) <> 1 THEN
    RAISE EXCEPTION 'Exactly one existing, email-verified Auth identity must match';
  END IF;
END $$;

INSERT INTO public.users (oidc_issuer, oidc_subject, email, display_name)
SELECT 'https://ovzjhaykcrtvyoxneydc.supabase.co/auth/v1',
       a.id::text, a.email, 'CORNOD Owner'
FROM auth.users a JOIN cornod_verified_owner v ON v.id=a.id
ON CONFLICT (oidc_issuer, oidc_subject) DO UPDATE SET email=EXCLUDED.email
RETURNING id;

INSERT INTO public.memberships (tenant_id,user_id,role)
SELECT t.id,u.id,'TENANT_OWNER'
FROM public.tenants t JOIN public.users u
 ON u.oidc_issuer='https://ovzjhaykcrtvyoxneydc.supabase.co/auth/v1'
JOIN cornod_verified_owner v ON u.oidc_subject=v.id::text
WHERE t.slug='cornod-private'
ON CONFLICT (tenant_id,user_id) DO UPDATE
 SET role='TENANT_OWNER',revoked_at=NULL;
COMMIT;
