# Verification record

Round 2 audit date: 2026-10-18 (evening). Environment: Windows 11, Node.js v24.21.0, npm 11.12.1.

Legend: ✅ verified (evidence below) · 🟡 implemented but unverified (needs
credentials) · 🧪 labeled fixture/simulation · ⬜ not yet done

## Round 2 audit — findings and fixes

### 1. Capture status handling (was: resolved unconditionally) — FIXED ✅

**Found:** `POST /api/rentals/:id/resolve` set `resolved_captured` without
checking the capture status PayPal returned.

**Fix:** only `COMPLETED` resolves the rental. `PENDING` returns HTTP 202 and
parks the rental in `attention` with a `pendingCapture` record (no confirmed
outcome is displayed); a new owner-only `POST /:id/reconcile` endpoint
re-reads the capture from PayPal (`GET /v2/payments/captures/{id}`) and either
finalizes, reports still-pending, or returns the rental to `under_review`
with no money moved. `DECLINED`/`FAILED`/unknown statuses return 502
`CAPTURE_NOT_COMPLETED` and the rental stays under review.

**Regression tests:** `PENDING capture parks the rental in attention;
reconcile completes it`, `PENDING capture that later fails returns the rental
to review`, `DECLINED capture is an error, not a resolution`.

### 2. Partial final-capture behavior — VERIFIED FROM DOCS ✅ / sandbox 🟡

Verified 2026-10-18 against the official PayPal v1→v2 migration guide
(developer.paypal.com, authority: PayPal):

- `final_capture` **defaults to `false`** in Payments v2 (inverted from v1);
  without `true`, "every v2 capture leaves the authorization open, causing
  unexpected balance holds." FairHold always sends `final_capture: true`
  explicitly. ✅
- A final capture **voids the authorization** — the uncaptured remainder is
  released. (Guide: v1 default behavior "voided the authorization after
  capture"; test checklist confirms `final_capture: false` leaves the
  authorization `CREATED`.) ✅ docs / 🟡 live sandbox
- `void` returns `204 No Content` — the client parses no body. ✅ (code path)
- `PayPal-Request-Id` retention window is **6 hours** (reduced from 30 days).
  Documented in README.
- `Prefer: return=representation` is required to read financial response
  fields — already sent on every call. ✅

**Display fix:** the receipt no longer infers the remainder by subtraction.
After a `COMPLETED` capture the server calls `GET /v2/payments/authorizations/{id}`
and displays the authorization status PayPal actually reports (simulation
reports `VOIDED`; the exact live status string is 🟡 pending sandbox
confirmation). If the lookup fails, the receipt says so and points at the
sandbox dashboard.

### 3. Expiry, honor period, partial-capture requirements — VERIFIED FROM DOCS ✅

- Authorization valid **29 days**; capture within the **3-day honor period**;
  reauthorization restarts the honor period within the 29 days.
  (developer.paypal.com authorize & capture guide, fetched 2026-10-18.)
- Partial capture in Payments v2 = send a smaller `amount`; **no account
  feature flag is documented** for the REST path (the "limited processors"
  note applies to Braintree partial settlement, a different product). 🟡
  sandbox confirmation pending.
- The demo journey completes in minutes, so expiry/honor-period handling is
  documented but not exercised; the UI shows the authorization expiry
  timestamp PayPal returns. Demo scenario limited to: single authorize,
  single final partial capture, void, reconcile — all capabilities verified
  above.

### 4. Owner/renter authorization — FIXED ✅

**Found:** the "owner decides" button was a UI affordance only; anyone could
call payment-changing endpoints.

**Fix:** each rental now gets an `ownerKey` and `renterKey` (random 192-bit,
returned exactly once at creation; only SHA-256 hashes persist). Enforcement:
`resolve` / `cancel` / `reconcile` require the owner key; `authorize`
requires the renter key; `report` accepts either; missing/wrong keys → 403.
Key hashes are never serialized in API responses. The UI hands keys off once
(CopyFields), stores them per browser in localStorage, and offers paste-in
key entry for a second browser/persona.

**Regression test:** `role keys protect payment-changing endpoints` (no key,
wrong key, cross-role key all 403). **Limitation (documented):** demo-grade
capability keys, not accounts/OAuth; required before any public deployment
beyond judging.

### 5. AI deductions framed as proposals; evidence verified — FIXED ✅

**Found:** wording ("assessment", "AI review") could imply independent
verification; quoted evidence was not checked against the source report.

**Fix:** prompt v1.2 requires `evidence` to be a **verbatim quote** from the
report and frames output as a proposal; the server now checks each quote
against the actual report text (normalized containment) and flags every line
item `evidenceVerified: true | false | null` — displayed in the UI ("quoted
verbatim" / "quote NOT found in the report — treat with caution"). UI and
submission copy now say "proposal based on the submitted report", with an
explicit disclaimer: not independent proof of damage, not objective
adjudication, amounts are illustrative rather than verified repair costs.
The fixture adapter quotes a verbatim window of the report.

**Regression test:** `evidence quotes are checked against the source report`.

## What ran, with results

| Area | Status | Evidence |
|---|---|---|
| Unit + integration tests | ✅ 30/30 pass | `npm test` → `tests 30, pass 30, fail 0` (round 2, includes all regression tests above) |
| Production build | ✅ | `tsc -b && vite build` clean (dist ~304 kB JS, gzip ~94 kB) |
| Live server smoke test (round 2) | ✅ | curl session 2026-10-18: resolve without key → 403; owner key on authorize → 403; renter key → 200; report → proposal with `evidenceVerified: true,true`; owner capture $15 → `resolved_captured` with `status: COMPLETED`, `finalCapture: true`, `authorizationStatus: VOIDED` |
| Dev-mode run | ✅ (round 1) | API :8787 + Vite :3000 proxy verified; servers stopped afterwards |
| PayPal sandbox with real credentials | 🟡 | Adapter + mocked-response tests done; real calls await the entrant's sandbox app credentials — script below |
| Live AI model | 🟡 | Adapter verified against OpenAI's current model docs (gpt-4o-mini: Chat Completions + Structured Outputs supported, fetched 2026-10-18); real call awaits AI_API_KEY |
| Simulated payments | 🧪 | Used in all API tests; labeled in UI badges, receipts, `/api/health` |
| Fixture AI | 🧪 | Deterministic keyword scan with verbatim quotes; labeled everywhere |

## Real-sandbox verification script (run once credentials exist)

1. Create `.env` from `.env.example` locally and add
   `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (Developer Dashboard → Apps &
   Credentials → Sandbox) and `AI_API_KEY`. **Never paste secrets into chat,
   issues, or commits** (`.gitignore` excludes `.env`).
2. `npm run dev`; confirm header badges switch to "PayPal sandbox · live" /
   "AI model · live".
3. Create the sample $60 tent hold; save the role keys; approve in the PayPal
   sheet with a **sandbox buyer** account; confirm `hold_active`.
4. Submit the scratch/dent report; confirm the live proposal is itemized,
   ≤ $60, and evidence quotes verify.
5. Capture $18.50 → expect `COMPLETED`; confirm the receipt's authorization
   status (expected `VOIDED` per docs — record the actual string here: ______).
   In the sandbox dashboard, confirm the partial capture and released remainder.
6. Negative paths: capture > $60 (reject), double-click capture (one charge),
   cancel a second rental mid-hold (void). If a capture ever returns PENDING,
   use "Check capture status" to reconcile.
7. Record redacted results (IDs only, no emails/keys) below.

- [ ] Real sandbox journey verified end-to-end (record redacted order/auth/capture IDs)
- [ ] Live model proposal verified
- [ ] Post-capture authorization status string observed in live sandbox
- [ ] Demo video recorded against real integrations
- [ ] Public repo created (no `.env`, no secrets)
- [ ] YouTube video uploaded (public) and linked in Devpost
- [ ] Devpost submission form completed before Nov 12, 2026 12:00 PT

## Test-type disclosure

Mocked tests (adapter tests with injected `fetch`, fixture AI, simulated
PayPal) are distinguished from external-integration verification above; the
only network calls made so far were to this app's own API and to public
documentation pages. No real PayPal or AI provider calls have been made yet —
none are claimed.
