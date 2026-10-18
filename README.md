# FairHold

**AI-assisted refundable deposits on PayPal — hold now, propose fairly, and let the owner settle when the item comes back.**

FairHold lets anyone lending or renting out an item (a tent, a camera, a power
tool) place a **PayPal authorization hold** as a deposit — the renter is not
charged. When the item comes back, an **AI condition proposal** reads the
return report, compares it against the checkout baseline, and suggests an
itemized deduction with verbatim evidence quotes. The **owner makes the final
call** (owner key required): PayPal captures exactly the confirmed amount and,
per PayPal's documented `final_capture` behavior, the authorization is voided
and the uncaptured remainder released.

Built for the PayPal AI Hackathon (submission period Oct 1 – Nov 12, 2026).

- Why PayPal is central: the product *is* a payment state machine —
  `authorize → partial capture | void | reconcile` (Orders v2 + Payments v2,
  sandbox), with idempotent mutations and capture statuses checked explicitly.
- Why AI is central: turning unstructured condition reports into bounded,
  itemized proposals is judgment over free text — the part rules and forms do
  badly. The AI never sets authoritative amounts, never calls a payment API,
  and its evidence quotes are checked against the source report. A human with
  the owner key authorizes every capture.

## Quick start

Prerequisites: **Node.js 20+** and npm. No accounts or keys are required to
explore the app — without credentials it runs in a **clearly labeled**
simulation/fixture mode.

```bash
npm install
npm run dev        # API on :8787, web UI on http://localhost:3000
```

Production-style single-port run:

```bash
npm run build
npm start          # serves UI + API on http://localhost:8787
```

Tests and reset:

```bash
npm test           # 30 tests: state machine, capture statuses, role keys, AI validation, full API journey
npm run seed       # reset demo data at any time
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

1. **PayPal sandbox (5 min).** Log in at
   [developer.paypal.com](https://developer.paypal.com/) → *Apps & Credentials*
   → **Sandbox** → *Create App* → copy the **Client ID** and **Secret** into
   `.env` (see `.env.example`). Under *Testing Tools → Sandbox Accounts*, note
   one **buyer** account's email + password — you'll use it in the approval
   sheet.
2. **AI model (5 min).** FairHold speaks to any OpenAI-compatible chat
   completions endpoint. Default: OpenAI `gpt-4o-mini` (verified 2026-10-18:
   supports Chat Completions and Structured Outputs; note the OpenAI API has
   no free tier — a small paid balance or any compatible provider works). Put
   the key in `AI_API_KEY`; override `AI_BASE_URL` / `AI_MODEL` for other
   providers.
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

## Payment correctness notes (verified 2026-10-18)

- `final_capture: true` is sent explicitly on every capture — Payments v2
  defaults it to `false`, which would leave the buyer's hold open.
- Only a `COMPLETED` capture resolves a rental. `PENDING` parks the rental in
  an *attention* state with a one-click reconcile (`GET
  /v2/payments/captures/{id}`); `DECLINED`/`FAILED` are errors, not
  resolutions.
- The receipt's "remainder released" statement comes from PayPal's own
  authorization status after the capture — not from local subtraction.
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
- The prompt is versioned (`server/prompts/assessment.v1.md`, v1.2); the
  condition report is treated as untrusted input with injection hardening;
  evidence quotes are verified against the report.

## For judges

- The app runs end-to-end with **zero configuration** in labeled
  simulated/fixture mode (all features exercisable, honestly labeled).
- To see the real PayPal sandbox flow, sandbox credentials are required. They
  are **not** in this repository (per the rules, secrets must not be
  published); they are provided through the Devpost submission's private
  testing instructions, together with a sandbox buyer account.
- Project access remains available free of charge through the end of the
  judging period (Dec 15, 2026 08:00 PT).

## Repository map

| Path | Contents |
|---|---|
| `RESEARCH.md` | Requirements checklist, deadline verification, candidate research, selection rationale |
| `SPEC.md` | Implementation specification and acceptance criteria |
| `VERIFICATION.md` | Audit findings/fixes, what was tested, what still needs credentials |
| `SUBMISSION.md` | Devpost submission copy (draft) |
| `VIDEO_SCRIPT.md` | Demo video script + shot list (2:40 target) |
| `ATTRIBUTION.md` | Dependencies, assets, tools, and AI-assistance record |
| `server/` | Express API, state machine, PayPal + AI adapters, tests |
| `src/` | React frontend |

## Limitations

Demo-grade role keys instead of user accounts/OAuth (required before public
deployment); demo-scale JSON persistence; sync verification + manual
reconcile instead of webhooks; sandbox-only payments; fixture AI when no key
is configured; text-only condition reports (no image analysis yet); AI
proposals are advisory and based solely on the submitted report.
