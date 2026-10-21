# FairHold

[![Verify FairHold](https://github.com/iftiikhaarr-glitch/fairhold/actions/workflows/ci.yml/badge.svg)](https://github.com/iftiikhaarr-glitch/fairhold/actions/workflows/ci.yml)

**AI-assisted refundable deposits on PayPal — hold now, propose fairly, and let the owner settle when the item comes back.**

FairHold lets anyone lending or renting out an item (a tent, a camera, a power
tool) place a **PayPal authorization hold** as a deposit — the renter is not
charged. When the item comes back, an **AI condition proposal** reads the
return report, compares it against the checkout baseline, and suggests an
itemized deduction with verbatim evidence quotes. The **owner makes the final
call** (owner key required): PayPal captures exactly the confirmed amount
with `final_capture: true`. The receipt displays PayPal's returned capture
and authorization statuses. The verified sandbox run returned `CAPTURED`
after a partial final capture; an explicit release uses the void endpoint.

Built for the PayPal AI Hackathon (submission period Oct 1 – Nov 12, 2026).

**Release review:** dependency remediation, Tailwind 4 migration, and protected
judging-demo configuration are included. See `RELEASE_CHECK.md` for validation
and `DEPLOYMENT.md` for setup, hosting, and private server configuration.

- Why PayPal is central: the product *is* a payment state machine —
  `authorize → partial capture | void | reconcile` (Orders v2 + Payments v2,
  sandbox), with idempotent mutations and capture statuses checked explicitly.
- Why AI is central: turning unstructured condition reports into bounded,
  itemized proposals is judgment over free text — the part rules and forms do
  badly. The AI never sets authoritative amounts, never calls a payment API,
  and its evidence quotes are checked against the source report. A human with
  the owner key authorizes every capture.

## Quick start

Prerequisites: **Node.js 22.12+** and npm (verified locally with Node.js 24.15.0). No accounts or keys are required to
explore the app — without credentials it runs in a **clearly labeled**
simulation/fixture mode.

```bash
npm ci
npm run dev        # API on :8787, web UI on http://localhost:3000
```

Production-style single-port run:

```bash
# In .env, set FAIRHOLD_APP_URL=http://localhost:8787 before checkout.
npm run build
npm start          # serves UI + API on http://localhost:8787
```

Tests and reset:

```bash
npm test           # state machine, capture statuses, access controls, AI validation, full API journey
npm run seed       # only local simulated data; refused for sandbox records or production
npm run check      # lint + tests + build + dependency audit
npm run smoke      # protected production boot/asset check, no external integration calls
```

Real-integration verification (after `.env` is configured and the server is running):

```bash
npm run verify:ai     # one real call to the configured AI provider; records redacted evidence
npm run verify:live   # full real PayPal sandbox journey (pauses for you to approve in the browser)
```

Both scripts append redacted results (IDs only — never secrets) to
`VERIFICATION_LIVE.md` and exit non-zero on failure, so mocked tests and real
external calls are never conflated.

## Enabling the real integrations (smallest setup, ~10 minutes)

All secrets live in a local `.env` file that is git-ignored. **Never paste
keys into chat, tickets, or commits.**
Create it by copying `.env.example` to `.env` in the project folder
(PowerShell: `Copy-Item .env.example .env`), then replace the placeholders.

1. **PayPal sandbox (5 min).** Log in at
   [developer.paypal.com](https://developer.paypal.com/) → *Apps & Credentials*
   → **Sandbox** → *Create App* → copy the **Client ID** and **Secret** into
   `.env` (see `.env.example`). Under *Testing Tools → Sandbox Accounts*, note
   one **personal/buyer sandbox** account's email. Use its sandbox password
   (set it through the account's Change password option if necessary), not
   your real PayPal account password, in the approval sheet.
2. **AI model (5 min).** FairHold speaks to any OpenAI-compatible chat
   completions endpoint. A real OpenAI `gpt-4o-mini` call was verified on
   2026-10-19. Put the key in `AI_API_KEY`; override `AI_BASE_URL` / `AI_MODEL`
   for another provider. The provider must support the adapter's chat-completions
   JSON response mode; billing and model access depend on that provider.
3. Restart `npm run dev`. The header badges switch from the labeled
   simulation/fixture modes to "PayPal sandbox · live" / "AI model · live".

Integration modes are always visible: badges in the header, `aiMode` on each
proposal, `paypal.mode` on each receipt, and `GET /api/health`.

## Demo walkthrough (90 seconds)

1. **New deposit hold** → *Fill sample scenario* → create the $60 tent hold.
   **Save the two role keys** (owner + renter) — shown once; stored in this
   browser automatically.
2. As the renter, approve the hold (PayPal sandbox sheet with the sandbox
   buyer account, or the labeled simulated button). The hold is active;
   **$0 charged**.
3. File the return report: *"Rainfly has a long scratch and one pole is
   dented. Stakes all returned."*
4. **Run AI condition review** → an itemized proposal; every line shows
   whether its evidence quote was found verbatim in the report.
5. As the owner, adjust the amount if you like, then **Capture deduction** —
   or release in full. The receipt shows the verified capture (ID + status),
   and the authorization status **as reported by PayPal** after the final
   capture. If PayPal ever returns a pending capture, the app says so and
   reconciles instead of claiming success.

## Payment correctness notes (sandbox journey verified 2026-10-19)

- `final_capture: true` is sent explicitly on every capture — Payments v2
  defaults it to `false`, which would leave the buyer's hold open.
- Only a `COMPLETED` capture resolves a rental. `PENDING` parks the rental in
  an *attention* state with a one-click reconcile (`GET
  /v2/payments/captures/{id}`); `DECLINED`/`FAILED` are errors, not
  resolutions.
- The receipt shows PayPal's actual authorization status after capture. It
  does not infer a release or funding-source availability from subtraction.
- Authorizations are valid 29 days; capture within the 3-day honor period
  (the demo completes in minutes; the expiry timestamp is displayed).
- Every payment mutation carries a stable `PayPal-Request-Id` (PayPal
  deduplicates retries within a 6-hour window) plus application-level replay
  protection; double-clicks cannot double-charge.
- Over-limit captures are rejected server-side before PayPal is called.

## Security model (demo grade)

Payment-changing endpoints (capture, release, cancel, reconcile) require the
per-rental **owner key**; approving the hold requires the **renter key**.
Keys are returned once at creation; only SHA-256 hashes are stored. This is
honest demo-grade capability security — **before any public deployment beyond
judging, replace it with real accounts/OAuth and per-user rental scoping**
(see Limitations). Secrets (PayPal secret, AI key) never leave the server;
the browser only sees the public client ID.

## Architecture

```
┌─ React + Vite + Tailwind + shadcn/ui (src/) ─────────────┐
│  state-driven workflow UI, PayPal JS SDK (intent=authorize)│
│  role-key handoff + localStorage, evidence-verified chips  │
└──────────────────────┬───────────────────────────────────┘
                       │ /api/*  (X-Rental-Key role enforcement)
┌──────────────────────▼───────────────────────────────────┐
│  Express (server/)                                        │
│  ├─ machine.js   pure deposit state machine (unit-tested) │
│  ├─ paypal.js    Orders v2 + Payments v2 sandbox adapter; │
│  │               capture status handling + reconcile;      │
│  │               labeled simulated adapter with same rules │
│  ├─ ai.js        OpenAI-compatible adapter (JSON mode,     │
│  │               timeout/retry) + zod/business validation; │
│  │               verbatim evidence verification; fixture   │
│  ├─ app.js       REST API, role keys, idempotency, events  │
│  └─ store.js     JSON persistence, atomic writes, cents    │
└───────────────────────────────────────────────────────────┘
```

Key design rules (see SPEC.md for the full spec):

- Money is integer cents server-side; decimal strings only at the PayPal
  boundary. Authoritative amounts are always computed server-side.
- Order created ≠ approved ≠ authorized ≠ capture accepted ≠ capture
  COMPLETED. The UI reports success only after PayPal confirms.
- The prompt is versioned (`server/prompts/assessment.v1.md`, v1.3); the
  condition report is treated as untrusted input with injection hardening;
  evidence quotes are verified against the report.

## For judges

- The app runs end-to-end with **zero configuration** in labeled
  simulated/fixture mode (all features exercisable, honestly labeled).
- Real sandbox and live-model results are recorded in `VERIFICATION_LIVE.md`.
  Reproducing them requires your own sandbox app and AI credentials. This
  repository contains no credentials.
- **Submission preparation is in progress:** the demo video and judge-access
  instructions have not yet been published. Before
  submission, arrange free runnable access through the judging period
  specified in the supplied rules (Dec 15, 2026 08:00 PT). Keep server secrets
  private; do not put API keys in Devpost text or the video.

## Repository map

| Path | Contents |
|---|---|
| `RESEARCH.md` | Requirements checklist, deadline verification, candidate research, selection rationale |
| `SPEC.md` | Implementation specification and acceptance criteria |
| `VERIFICATION.md` | Historical local audit findings and test evidence |
| `VERIFICATION_LIVE.md` | Actual external AI and PayPal sandbox results |
| `RELEASE_CHECK.md` | Release checks, dependency remediation, and historical audit |
| `DEPLOYMENT.md` | Build, server configuration, hosting, and deployed acceptance |
| `SUBMISSION.md` | Devpost submission copy (draft) |
| `VIDEO_BUILD_SCRIPT.md` | Build-to-demo recording script (2:50 target) |
| `ATTRIBUTION.md` | Dependencies, assets, tools, and AI-assistance record |
| `server/` | Express API, state machine, PayPal + AI adapters, tests |
| `src/` | React frontend |

## Limitations

Demo-grade role keys instead of user accounts/OAuth (required before public
deployment); demo-scale JSON persistence; sync verification + manual
reconcile instead of webhooks; sandbox-only payments; fixture AI when no key
is configured; text-only condition reports (no image analysis yet); AI
proposals are advisory and based solely on the submitted report.

For a hosted judging demo, `NODE_ENV=production` requires an HTTPS app origin,
a demo access password of at least 24 characters, and an explicit data path.
Use durable storage and a single server instance. Shared demo access protects
the page and API; per-rental role keys still protect payment actions. This
does not provide tenant isolation. See `DEPLOYMENT.md` and `render.yaml`.

### Checkout without popups

New sandbox orders include PayPal return and cancellation URLs. If the standard PayPal button cannot open its popup, select **Open PayPal in a new tab**, approve using the sandbox personal/buyer account, return to FairHold, and select **Check PayPal approval**. The backend checks PayPal's approval state before authorizing; clicking the check button alone cannot approve a payment.

For local development, the return origin defaults to `http://localhost:3000`. For the single-port production server, set `FAIRHOLD_APP_URL=http://localhost:8787`; for a hosted demo, set it to the demo's HTTPS origin before creating orders. Already-created orders retain their original return URLs.
