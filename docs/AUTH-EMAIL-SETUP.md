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

## Browser handling and permissions

- No user password is requested and no user access/refresh token is written to localStorage or persisted anywhere.
- The access token is held in memory; refreshing the page requires signing in again.
- The Auth client sends requests only to the fixed Supabase Auth origin listed in the CSP.
- Signing up can create an Auth user if enabled but **does not** insert rows into `public.users`, `public.memberships` or `public.project_memberships`.
- The admin console is disabled in the public frontend. Real tenant-owner permissions require verified backend authorization and a separately approved owner bootstrap.
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
