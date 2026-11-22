# CORNOD email sign-in (GitHub Pages + Supabase Auth)

This is a real Supabase Auth sign-in flow, but it is **not** the privileged CORNOD API, owner console, or VM runtime. A confirmed email account does not grant tenant membership or administrator access.

## Published site

- App: https://abdulls95.github.io/members/#/signin
- Supabase Auth project: `ovzjhaykcrtvyoxneydc`
- Public publishable key: `assets/js/core/auth-config.js`
- Service role and database keys MUST NOT be placed in a browser file.

## Dashboard checks required for real delivery

1. Open https://supabase.com/dashboard/project/ovzjhaykcrtvyoxneydc/auth/url-configuration
2. Set **Site URL** to `https://abdulls95.github.io/members/`.
3. Add `https://abdulls95.github.io/members/` to allowed **Redirect URLs**.
4. Confirm Email provider and signups are enabled in **Authentication → Providers**.
5. Default email template sends a **Magic Link**: click it to return to the site, where the access token is stripped from the fragment and the user is verified against `/auth/v1/user`.
6. To send a numeric one-time code instead, modify **Authentication → Email Templates → Magic Link** to include `{{ .Token }}` and keep the code input in the UI. Do not assume the default template includes a numeric code.
7. For reliable mail delivery, verify the sending-domain/SMTP limits and review Auth email rate limits.

## Owner approval gate (implemented)

- Auth signup verifies the email address but does **not** approve CORNOD access.
- The `public.account_approvals` table is created and auto-populated by an `auth.users` trigger; new accounts default to `pending`.
- `approved` accounts may navigate ordinary CORNOD sections; `rejected`, `pending`, unknown or lookup-error accounts cannot.
- Only the verified account `a.alyf3i@gmail.com` is eligible to become `owner`. It must exist and be email-confirmed in this same Supabase project. No similar-looking email is privileged.
- The owner sees `#/admin` and can approve/reject accounts. Row Level Security checks owner identity by `auth.uid()` against `auth.users`, requiring the exact verified email; self-selected browser roles cannot approve.
- The Supabase table grants authenticated users SELECT only on their own row; only the verified owner may read other requests and update status. No account can directly modify the stored email/owner status.
- Do not expose credentials or service-role keys in GitHub Pages.
- The GitHub Pages **static source is publicly downloadable**. The navigation gate is a UX barrier, not confidentiality of JS/CSS or a complete private app. Any future API, file storage, real terminals and workspaces MUST enforce approval and owner permissions again on the server.
- This project has no confirmed email owner account yet. The existing similarly spelled account is pending; verify the exact approved owner email via signup/confirmation before the approval dashboard can operate.

## Browser handling and permissions

- No user password is requested and no user access/refresh token is written to localStorage or persisted anywhere.
- The access token is held in memory; refreshing the page requires signing in again.
- The Auth client sends requests only to the fixed Supabase Auth origin listed in the CSP.
- Signing up can create an Auth user if enabled but **does not** insert rows into `public.users`, `public.memberships` or `public.project_memberships`.
- Owner approvals are managed in the UI with Supabase RLS. Private API / tenant administration still require server-side authorization.
- The static site is publicly accessible. Do not confuse `noindex` with access control.
- Until the backend is deployed, this login confirms email identity only; it does not launch Linux or enable a hosted terminal.

## Manual acceptance test

1. Visit the sign-in page and enter an email address you own. Select **Send sign-in email**.
2. Follow the magic link in the same browser or (if configured) enter the numeric email code.
3. Confirm the page shows your verified email and a Sign Out button.
4. Confirm `#/admin` still displays the locked message. Email verification does not grant admin roles.
5. Sign out, then confirm the email input form returns.
6. Check Supabase Authentication → Users for the new verified account. Do NOT share the emailed link or OTP in support chats.

If the email link opens another site, the Site URL or Redirect URL allowlist needs correcting in the Supabase dashboard. If the request returns HTTP 429, wait for the provider email rate limit.
