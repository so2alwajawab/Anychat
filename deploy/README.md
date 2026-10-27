# Deploy (Phase 2)

Production-style stack: `postgres` + `redis` + `api` (NestJS) + `web` (Next.js,
same-origin `/api` proxy). All ports are published on **loopback only** — put a
reverse proxy with TLS in front (final ports/targets pending owner confirmation,
see report Q15).

## Steps

1. Copy the template and set strong passwords:

   ```bash
   cp .env.example deploy/.env
   # edit deploy/.env: POSTGRES_PASSWORD, REDIS_PASSWORD, API_BASE_URL,
   #                   APP_ENCRYPTION_KEY, PUBLIC_BASE_URL, META_APP_ID,
   #                   META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN
   ```

   Generate the encryption key (32 random bytes, base64) — required, the API
   refuses to start without it in production:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   `PUBLIC_BASE_URL` is the HTTPS origin users reach the app on (e.g.
   `https://anychat.example.com`); the API derives the OAuth redirect URI and
   webhook callback URL from it.

2. Build and start:

   ```bash
   docker compose -f deploy/compose.yml up -d --build
   ```

   This applies Prisma migrations (`migrate` service) before the API starts.

3. Create the owner account (break-glass, run once):

   ```bash
   docker compose -f deploy/compose.yml exec api \
     node apps/api/dist/cli/bootstrap.js --username=owner --password='<strong-password>'
   ```

   Save the printed recovery code offline. Rotate later with
   `... cli/new-recovery.js --username=owner`.

4. Open `http://127.0.0.1:3001/login` (or via your reverse proxy domain),
   then finish the **Meta App Dashboard** setup (see below).

## Meta App Dashboard setup (one-time, per app)

In [developers.facebook.com](https://developers.facebook.com) → your app
(Business type, single-owner):

1. **Settings → Basic**: copy App ID / App Secret into the Connections page
   (`/connections`) and save.
2. **Facebook Login → Settings → Valid OAuth Redirect URIs**: add exactly

   ```
   {PUBLIC_BASE_URL}/api/v1/meta/oauth/callback
   ```

3. **Webhooks → Configuration**: set the **callback URL** to
   `{PUBLIC_BASE_URL}/api/v1/meta/webhooks/meta` and the **verify token** to
   the same long random string configured as `META_WEBHOOK_VERIFY_TOKEN` /
   in the Connections page.
4. **Permissions**: request the scopes approved in the Phase 0 report
   (`pages_show_list, pages_read_engagement, pages_manage_engagement,
   pages_manage_metadata, instagram_basic, instagram_manage_comments,
   pages_messaging`). In Dev mode the admin account can grant them; if
   Facebook requires Advanced Access for webhooks, submit App Review.
5. Back in the app: **ربط حساب ميتا** → Facebook consent → pages are
   discovered, tokens sealed (AES-256-GCM), page webhook subscription
   created. Instagram webhook subscription (`comments`, `mentions`) must be
   added manually in the dashboard; the app records it as `dashboard_required`.
6. Post a test comment on a connected page to confirm delivery shows up in
   **تشخيص الويب هوك** on the Connections page.

## Ports (provisional)

| Service | Published on | Container |
|---|---|---|
| web | 127.0.0.1:3001 | 3000 |
| api | 127.0.0.1:4001 | 4000 |
| postgres | 127.0.0.1:25432 | 5432 |
| redis | 127.0.0.1:26379 | 6379 |

## Notes

- Session cookies are `Secure`; browsers accept them on `localhost`, but any
  non-localhost deployment **must** be served over HTTPS.
- The web image bakes `API_PROXY_TARGET` at **build** time (Next.js rewrites
  are compiled into the routes manifest); override the build arg if the API
  service name changes.
- Backups, monitoring, and public port reduction (80/443 only) land in later
  phases per the Phase 0 plan.
