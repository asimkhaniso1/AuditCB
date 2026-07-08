# Deployment & Environment Configuration

This app has **three** independently-configured runtimes, each with its own
secrets. A change in one (especially a **domain change**) does not propagate to
the others — several outages have been traced to config that was set in one
place but not the others. Use this document as the checklist.

> ⚠️ **Environment variable names are CASE-SENSITIVE.** A variable named
> `Gemini_API_Key` is **not** the same as `GEMINI_API_KEY`. The code reads the
> exact names in the tables below. A single casing mismatch silently disables a
> whole feature area (the AI proxy returns `500 "API Key not found"` and the app
> falls back to canned local data — see history: this exact typo took down all
> AI features while the key value was present the whole time). Copy the names
> from this doc verbatim.

---

## 1. Where things run

| Runtime | Hosts | Config lives in |
|---|---|---|
| **Vercel** | the static app + `api/*.js` serverless functions | Vercel → Project → Settings → Environment Variables |
| **Supabase Postgres** | the database, RLS policies, triggers | Supabase SQL Editor / dashboard |
| **Supabase Edge Functions** | `supabase/functions/*` (invite-user, send-email, validate-*) | Supabase → Edge Functions → Secrets (`supabase secrets set`) |

The production domain is a **custom domain** (`audit360.isoxpert.com`) attached to
the Vercel `audit-cb` project. `audit-cb.vercel.app` points at the same project.

---

## 2. Vercel environment variables

Set under **Settings → Environment Variables**, scope **Production** (+ Preview
if used). Names are read literally by the code at the cited locations.

| Variable | Read by | Required? | Purpose / symptom if missing |
|---|---|---|---|
| `GEMINI_API_KEY` | [api/gemini.js:26](api/gemini.js:26) | **Yes** | Google Gemini key for the AI proxy. Missing → `500`, **all AI features dead** (KB analysis, audit scoping, report gen, NCR findings). |
| `SUPABASE_URL` | [build.js:187](build.js:187) | Yes | Baked into `env-config.js` at build. Missing → app uses localStorage fallback for Supabase config. |
| `SUPABASE_ANON_KEY` | [build.js:188](build.js:188) | Yes | As above (public anon key — safe client-side). |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | [api/send-email.js:12-17](api/send-email.js:12) | For email | SMTP creds for the Vercel email endpoint. Missing → outbound email fails. |
| `CORS_ORIGIN` | [api/gemini.js:5](api/gemini.js:5), [api/send-email.js:28](api/send-email.js:28) | On new domain | Add the production origin (`https://audit360.isoxpert.com`). Same-origin `/api/*` calls work without it, but set it so cross-origin callers aren't rejected. |
| `SENTRY_DSN` | [build.js:189](build.js:189) | Optional | Error monitoring; leave empty to disable. |
| `VERCEL_URL` | (auto) | — | Provided by Vercel automatically; do not set manually. |

> After changing any variable you **must redeploy** — env changes do not apply to
> the running deployment. Deployments → ⋯ on latest → Redeploy.

---

## 3. Supabase Edge Function secrets

These are **separate** from Vercel and are set with `supabase secrets set NAME=...`
(or the dashboard). Read via `Deno.env.get(...)`:

| Secret | Read by | Purpose |
|---|---|---|
| `SUPABASE_URL` | invite-user, send-email, validate-client | Project URL (auto-populated for edge fns in most cases). |
| `SUPABASE_SERVICE_ROLE_KEY` | [invite-user](supabase/functions/invite-user/index.ts:28), [send-email](supabase/functions/send-email/index.ts:74) | **Service-role** key — admin user creation, privileged writes. Keep secret; never expose client-side. |
| `SUPABASE_ANON_KEY` | validate-client | Anon key for user-context validation. |
| `RESEND_API_KEY` | [send-email](supabase/functions/send-email/index.ts:35) | Resend email provider (note: the Supabase send-email fn uses Resend, while the Vercel `api/send-email.js` uses SMTP — two different email paths). |

---

## 4. Supabase Auth URL configuration (the domain-change gotcha)

Auth redirect/callback URLs are **not** an env var — they live in
**Supabase → Authentication → URL Configuration**. When the app domain changes,
password-reset and email-confirmation links break until these are updated:

- **Site URL**: `https://audit360.isoxpert.com` (base URL stamped into reset/confirm emails)
- **Redirect URLs** (allowlist): add
  - `https://audit360.isoxpert.com/**`
  - `https://audit360.isoxpert.com/auth/callback` (invite-user redirects here)

---

## 5. "When the domain changes" checklist

A domain move requires touching **all four** of these — missing any one causes a
silent, feature-specific outage:

1. **Vercel → Domains** — attach the new domain to the `audit-cb` project.
2. **Vercel → Environment Variables** — confirm every var in §2 is present with
   the **exact** casing (re-verify `GEMINI_API_KEY`), then **redeploy**.
3. **Supabase → Authentication → URL Configuration** — update Site URL +
   Redirect URLs (§4).
4. **Vercel `CORS_ORIGIN`** — set to the new origin (§2).
5. If DNS is proxied (e.g. Cloudflare "Proxy Detected" in Vercel Domains),
   ensure the proxy is **not caching `/api/*`** and isn't stripping headers;
   prefer DNS-only for the record, or add a bypass rule for `/api/*`.

---

## 6. Database migrations

Supabase migrations are **not** run by the app build — they are applied manually
in the SQL Editor. The `migrations/` directory is an unordered history; the
authoritative recent hardening is:

- `migrations/HARDEN_RLS_PHASE2.sql` — role-aware RLS (Admin/Cert-Manager gated
  deletes, cert-decision & settings write restrictions, profiles
  self-role-escalation trigger, admin-can-update-any-profile policy).
- `migrations/HARDEN_RLS_PHASE2_ROLLBACK.sql` — one-paste revert if a policy
  change breaks a live flow.

Apply the forward file as a **single execution** in the SQL Editor (it uses a
temporary helper function). Keep the rollback file ready before applying.
