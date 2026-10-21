# Build, configuration, deployment, and recording

GitHub hosts the source and automated checks. FairHold's Express backend must
run on a Node hosting service: GitHub Pages alone cannot run PayPal or AI calls.
Replit is the selected host. The included `.replit` config builds and runs one
Express service for both the UI and API. `render.yaml` remains an optional
alternative. Configuration files alone are not evidence of deployment.

## Replit deployment

Import this repository without asking Agent to rebuild the app. Confirm the
runtime is Node 22.12+ (Replit import may replace the requested module with
Node 20; correct that before installing/building). `.replit` maps port 8787 to
the public web port, builds with `npm ci --include=dev && npm run build`, and
starts with `npm start`.

Create the app's PostgreSQL database through Replit's Database tool. Set
`FAIRHOLD_STORAGE=postgres`; the server requires `DATABASE_URL` and refuses to
fall back to ephemeral JSON. Replit manages separate development and production
databases: confirm the published service uses its production database, not a
copied development connection. Tables are initialized transactionally at startup.
This deployment begins with fresh synthetic rentals; private local payment
records are not migrated or erased.

Configure `NODE_ENV=production`, `DEMO_ACCESS_USER=judge`, a random
`DEMO_ACCESS_PASSWORD` of at least 24 characters, and `FAIRHOLD_APP_URL` equal
to the actual assigned public HTTPS origin. Add the sandbox PayPal client ID
and secret and `AI_API_KEY` through Replit Secrets, never through source code
or `VITE_` variables. The shared reviewer login is separate from integration
credentials. Web sign-in creates an eight-hour signed session in an HttpOnly,
Secure, SameSite=Lax cookie on HTTPS. API scripts can also use Basic
authorization. Sign-out clears the browser session; altered and expired cookies
are refused. Keep the password private and provide judge access through the approved
testing instructions.

Use Autoscale with durable PostgreSQL. Review actual estimated charges and
account spending controls before publishing. Database active time, compute,
requests, and storage can consume credits; a displayed balance is not a hard
project cap. Keep auto-reload disabled unless separately authorized. Render
does not need to be activated or paid for when Replit runs the app.

Run `npm run check` and `npm run smoke` in the imported workspace. GitHub CI
also runs the real PostgreSQL tests against an isolated PostgreSQL 16 service.
Local tests skip that suite unless a dedicated `TEST_DATABASE_URL` is set.
Never point tests at a production database. Health checks intentionally do
not query PostgreSQL, avoiding idle database wakeups from monitoring.

After publication, complete the deployed acceptance checks below and record
the actual URL, revision, observed payment statuses, and restart persistence.
Do not substitute the development preview URL for a published deployment.

## Local build (PowerShell)

Install Node.js 24.15.0, the version in `.node-version`, and Git. Open
PowerShell in the project folder, not `C:\Windows\System32`.

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` locally. For a real integration, replace `PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, and `AI_API_KEY` with your own sandbox/provider keys.
Use a PayPal sandbox personal buyer's separate credentials at checkout.
Leaving placeholders enables explicitly labeled simulation and fixture modes.
No real PayPal payment endpoints are supported.

```powershell
npm run check
npm run smoke
```

`check` runs lint, tests, TypeScript/Vite build, and an audit that fails on any
reported severity. `smoke` starts the built production server on a temporary
port with generated test access credentials and disabled external integrations,
checks its HTML/assets/API protection, then stops it. Neither command pays for
an AI call or creates a PayPal order.

For interactive development:

```powershell
npm run dev
```

Open `http://localhost:3000`. Keep that terminal open. For a single-port local
build, set `FAIRHOLD_APP_URL=http://localhost:8787` in `.env`, run
`npm run build`, then `npm start`, and open `http://localhost:8787`.
Restart after changing configuration. Existing PayPal orders retain their
original return URLs; use a new order after changing the origin.

## Proposed Render deployment

The Blueprint uses a **paid service and a 1 GB persistent disk**. Review the
provider's displayed recurring cost and agree a budget before creating it.
No hosting purchase is required just to review or publish this repository.
Pricing checked on 21 October 2026 lists $7/month for `0.5c-512mb` and
$0.25/GB-month for persistent disks: **$7.25/month base hosting** for this
configuration on the $0 workspace plan. Taxes, traffic/build overages, and AI
provider charges are additional. This estimate is not a hard billing cap;
confirm the provider's actual checkout before provisioning. See
[Render pricing](https://render.com/pricing).

The JSON store requires one application process and one instance; do not scale
it horizontally. A free ephemeral filesystem can lose payment state on restart
and is not the deployment proposed here.

1. Publish the reviewed source to GitHub. Confirm its **Verify FairHold**
   workflow passes before deployment.
2. Sign in to Render. Connect only the FairHold repository and create a
   Blueprint from `render.yaml`. Do not grant access to unrelated repositories.
3. Review the paid compute/disk configuration before accepting or purchasing
   services. `autoDeployTrigger: off` prevents later pushes from automatically
   replacing the running demo.
4. Set `FAIRHOLD_APP_URL` to the exact assigned public HTTPS origin. If the
   name is assigned after initial creation, update it and redeploy. Use no path
   suffix. Production startup requires this value, a long demo password, and
   an explicit data path.
5. Confirm these environment values in the server dashboard:

| Variable | Value / purpose |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.15.0` |
| `FAIRHOLD_APP_URL` | Actual HTTPS demo origin |
| `FAIRHOLD_DATA_FILE` | `/var/data/fairhold.json` on the attached disk |
| `DEMO_ACCESS_USER` | `judge` |
| `DEMO_ACCESS_PASSWORD` | Blueprint-generated random secret, at least 24 characters |
| `PAYPAL_CLIENT_ID` | Your sandbox app client ID |
| `PAYPAL_CLIENT_SECRET` | That app's sandbox secret, server-side only |
| `AI_API_KEY` | Your provider key, server-side only |
| `AI_BASE_URL` / `AI_MODEL` | Optional overrides; defaults are OpenAI and `gpt-4o-mini` |

6. Enter integration credentials directly into the hosting environment settings.
   Never commit `.env`, put keys in GitHub Actions, use `VITE_` variables for
   secrets, or display them in the video. Manage the AI provider's usage and
   budget controls separately; the demo login is not a spending limit.
7. Deploy. Build: `npm ci --include=dev && npm run build`. Start: `npm start`.
   Health: `/api/health`. Render supplies `PORT`. The frontend and API share one
   origin; no CORS proxy or separate frontend deployment is needed.
8. Open the HTTPS URL. The browser requests the shared demo login before
   exposing the app. Use it only for the judging demo over HTTPS. Rental
   owner/renter keys still control payment operations. Give authorized judges
   only the demo login and sandbox buyer login through organizer-approved
   private testing instructions, never your provider keys.

This is a protected, shared sandbox workspace for reviewers, not customer
accounts or isolated tenants. Reviewers with demo access can see its synthetic
rental records. A production rental business needs real account authorization,
durable database transactions, and a further security review.

## Deployed acceptance checks

- Without demo access, `/` and `/api/rentals` return 401; `/api/health` is the
  only public application endpoint.
- After login, the page and compiled JS/CSS load. Mode badges match configured
  integrations. A green badge alone does not verify a provider response.
- Create a fresh synthetic $60 rental, save its role keys privately, and
  approve with a sandbox buyer. The redirect returns to the deployed origin;
  **Check PayPal approval** verifies approval with PayPal.
- Submit the sample report, inspect the real model proposal and evidence
  flags, and have the owner confirm $18.50. Verify the actual capture status,
  ID, and authorization status. A separate rental verifies full void/release.
- Missing/wrong rental keys and over-limit amounts are refused. Replaying a
  completed decision returns its existing capture. In-flight conflicts return
  409 and must be refreshed after the first operation completes.
- Reset is disabled for sandbox rentals so it cannot erase outstanding holds.
  Cancel or resolve rentals individually.
- Restart the service and confirm records persist in PostgreSQL (or the
  attached disk for the optional JSON deployment). Retain
  redacted evidence. Do not reset or remove the disk while holds are active.
- Existing `verify:live` is intended for an unprotected local development
  server. Scripts against the protected host also need Basic authorization.

Hosted checks remain pending until a service actually exists. Do not mark
them passed from local tests or the previous sandbox run.

## Recording

Use `VIDEO_BUILD_SCRIPT.md` for the under-three-minute submission video and
optional longer technical walkthrough. Show configuration names and successful
check output; hide secret values. Pre-authenticate the sandbox buyer.

## Official references (reviewed 21 October 2026)

- [GitHub Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Render Node/Express deployment](https://render.com/docs/deploy-node-express-app)
- [Render Blueprint fields](https://render.com/docs/blueprint-spec)
- [Render persistent disks](https://render.com/docs/disks)
- [Tailwind 4 migration](https://tailwindcss.com/docs/upgrade-guide)
