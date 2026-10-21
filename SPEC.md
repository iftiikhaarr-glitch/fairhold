# FairHold — implementation specification

## 1. User journey and measurable benefit

Owner lists an item with a baseline condition and deposit amount → renter
approves a PayPal authorization hold (no charge) → on return, a condition
report is filed → AI proposes an itemized deduction bounded by the hold →
owner confirms or adjusts → PayPal captures the deduction as a final capture
→ both sides see the verified outcome and a full audit timeline.

Measurable benefit: deposit disputes resolve in one screen with an itemized,
evidence-cited proposal instead of a negotiation; the renter never pre-pays —
the hold is only captured in the confirmed amount.

Core acceptance scenario (observable):

> A user creates a rental with item, baseline condition and deposit X; the
> renter approves the PayPal hold (sandbox or labeled simulation); the user
> submits a return report; the AI produces a validated itemized assessment
> whose total never exceeds X; the owner authorizes deduction D ≤ X; the
> server captures exactly D with `final_capture=true` and persists the PayPal
> capture ID and status; the receipt shows D captured and the authorization
> status returned by PayPal, without inferring release from X−D.

## 2. Functional requirements and acceptance criteria

| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Create hold | Given valid inputs, POST /api/rentals returns 201 with state `awaiting_approval` and a PayPal order ID; invalid amounts/names → 400 |
| F2 | Renter approval | authorize call returns state `hold_active` with authorization ID and expiry; repeat call is a safe no-op |
| F3 | Condition report | Non-empty report ≤ 4000 chars → state `under_review` with assessment or labeled assessment failure |
| F4 | AI assessment | Output validates against schema; server recomputes total from line items; total > hold → rejected to manual review |
| F5 | Owner capture | capture D with 0 < D ≤ hold → PayPal capture attempted; only `COMPLETED` → state `resolved_captured` (capture ID + PayPal-reported authorization status persisted); `PENDING` → HTTP 202, state `attention` + `pendingCapture`; `DECLINED`/`FAILED` → 502 `CAPTURE_NOT_COMPLETED`, stays `under_review`; D > hold → 400 `AMOUNT_EXCEEDS_HOLD` |
| F6 | Release | release → authorization voided, state `resolved_released` |
| F7 | Idempotency | Same Idempotency-Key or repeated decision on a resolved rental replays without a second capture; the final capture closes further collection on that authorization |
| F8 | Cancel | Before approval → `cancelled`; with hold → void then `cancelled` |
| F9 | Audit | Every mutation appends a timestamped event; GET /api/rentals/:id returns the ordered timeline |
| F10 | Reset | POST /api/demo/reset clears simulation-only data; refused for sandbox integration or stored sandbox records |
| F11 | Labeled modes | Without credentials, UI badges and receipts visibly label SIMULATED payments / FIXTURE AI |
| F12 | Role keys | Per-rental owner/renter keys (returned once, SHA-256 hashes stored); `resolve`/`cancel`/`reconcile` require owner; `authorize` requires renter; `report` either; missing/wrong → 403 |
| F13 | Reconcile | Owner can re-read a pending capture from PayPal; outcome updates the rental truthfully (finalize / still pending / back to review) |
| F14 | Evidence verification | Each AI evidence quote is checked verbatim against the submitted report and flagged `true/false/null` in the UI |

## 3. Screens and interaction states

Single-page app: sidebar (rental list, new, reset) + detail panel driven by
the rental state: approval (PayPal Buttons / labeled simulated button),
report form with loading state, assessment card (line items, confidence,
prompt version, fixture badge), owner decision (amount input capped at hold,
capture/release), receipt, cancelled/empty/error states. Keyboard-accessible
(native form controls), labeled inputs, readable contrast.

## 4. Data model and payment state transitions

Rental: `id, itemName, ownerName, renterName, checkoutCondition,
depositCents, currency, state, paypal{mode, orderId, authorizationId,
captureId, expiresAt}, report, assessment, assessmentError, resolution,
createdAt, updatedAt`. Events append-only. Money is integer cents everywhere;
decimal strings only at the PayPal boundary.

State machine (`server/machine.js`, unit-tested):
`awaiting_approval → hold_active → review_pending → under_review →
resolved_captured | resolved_released`, plus `cancelled` and `attention`.
Illegal transitions throw and map to HTTP 409.

Payment truth: order created ≠ approved ≠ authorized ≠ captured. Success is
reported only after the PayPal capture/void call returns a success status.

## 5. AI inputs, outputs, permissions, failure handling

- Input: item name, checkout baseline, return report (bounded to 4000 chars),
  max deduction in cents. No credentials, payment tokens, or PII beyond first
  names enter the model context.
- Output: strict JSON `{summary, confidence, items[{label, amount, evidence}]}`
  validated with zod + business rules; total recomputed server-side; the model
  never sets authoritative amounts and never calls payment tools.
- Prompt: `server/prompts/assessment.v1.md`, versioned (`assessment.v1.1`),
  contains explicit injection hardening; report is framed as untrusted data.
- Failure: timeout 30s, one retry, invalid JSON/schema/over-limit → rental
  moves to `under_review` with `assessmentError` (manual review), never a
  silent guess.
- Fixture mode: deterministic keyword heuristic, labeled "FIXTURE" in the UI,
  the API (`aiMode`), and the audit log. It cannot substitute for live-model
  evidence (see VERIFICATION.md).

## 6. Application boundaries and integrations

- PayPal: Orders v2 (`intent=AUTHORIZE`) + Payments v2 (capture, void) against
  `https://api-m.sandbox.paypal.com` only. No production endpoint exists in
  code. Sync verification via API responses; webhooks are intentionally out of
  scope for the demo (documented limitation).
- AI: any OpenAI-compatible chat-completions endpoint via env config.
- Persistence: JSON file with atomic writes (demo-scale; see limitations).

## 7. Authentication and authorization

Demo-grade capability security: each rental gets an owner key and a renter
key (192-bit random, returned once, SHA-256 hashes stored). Payment-changing
endpoints (capture/release/cancel/reconcile) require the owner key; hold
approval requires the renter key. This replaces the earlier
"button-only" model after the round-2 audit. Authorization of consequential
payment actions is enforced in application code: only the explicit owner
decision (F5/F6) can capture or void; the AI has no payment tool access.
**Before public deployment beyond judging:** replace keys with real accounts
(OAuth) and per-user scoping — documented limitation.

## 8. Configuration, deployment, judge access

- `.env` (never committed): `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
  `AI_API_KEY`, optional `AI_BASE_URL`, `AI_MODEL`. `.env.example` ships
  placeholders only.
- Run: `npm ci`, then `npm run dev` (API :8787, web :3000) or
  `npm run build && npm start` (single port :8787).
- Validation: `npm run check`, then `npm run smoke`; see RELEASE_CHECK.md.
- Judges: run locally with the README; without any credentials the app is
  fully exercisable in labeled simulated/fixture mode; with the entrant's
  sandbox client ID/secret the real PayPal flow activates. Server integration
  secrets stay private. Hosted demo access and any sandbox buyer login must
  be shared through organizer-approved private instructions; they have not
  yet been supplied. Production judging-demo configuration requires a shared
  access password, HTTPS origin, explicit durable data path, and one instance.
  See DEPLOYMENT.md; real tenant accounts remain future work.
