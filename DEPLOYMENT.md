# Build, configuration, deployment, and recording

GitHub hosts the source and automated checks. FairHold's Express backend must
run on a Node hosting service: GitHub Pages alone cannot run PayPal or AI calls.
The included `render.yaml` proposes a protected sandbox judging demo with one
server and durable storage. It is configuration, not evidence of deployment.

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
- Restart the service and confirm records persist on the disk. Retain
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
