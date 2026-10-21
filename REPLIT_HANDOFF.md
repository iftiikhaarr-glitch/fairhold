# FairHold: continue on Replit without rebuilding

Prepared 21 October 2026. Read this before changing deployment or storage.

## Source and verified baseline

- Repository: https://github.com/iftiikhaarr-glitch/fairhold
- Runtime/code baseline: `c88a3cb63534fbc75b82f02c4f09860a4e7e17cb`.
- Passing Linux CI: https://github.com/iftiikhaarr-glitch/fairhold/actions/runs/39558336792
- Node 24.15.0; React/TypeScript, Vite 7.3.7, Tailwind 4.3.3, Express.
- `npm ci`, `npm run check`, and `npm run smoke` passed in a fresh clone.
  There were 40 passing tests and zero npm audit findings on this date.
- Build artifacts and `.env` are not committed. Read README.md,
  DEPLOYMENT.md, RELEASE_CHECK.md, VERIFICATION_LIVE.md, and
  VIDEO_BUILD_SCRIPT.md. Some historical audit sections retain earlier failures;
  the latest completed sections supersede them.

## Product to preserve

FairHold is a sandbox prototype for rental deposits: owner creates an item and
baseline condition; renter approves a PayPal authorization; an AI drafts an
itemized condition proposal; owner chooses a partial final capture or full void.
The model never initiates a payment. Proposals are advisory, not independent
damage evidence or verified repair costs. Report quotation matches are checked
and displayed, including explicit failed-match flags.

The real external journey was verified on 19 October: $60 authorization,
real `gpt-4o-mini` proposal, $18.50 final capture COMPLETED, same-capture retry,
separate $40 full void, and cancellation before approval. PayPal returned
CAPTURED for the post-capture authorization; explicit full release returned
VOIDED. Do not infer remaining-funds availability by subtraction. Pending and
declined exceptional outcomes have mocked tests, not induced external evidence.

Owner/renter keys protect rental operations; only key hashes are stored. A
shared Basic access gate protects the hosted judging demo, with cross-site
write refusal. This is a shared synthetic reviewer workspace, not isolated
customer accounts. Reset is refused for sandbox adapters or stored sandbox
records. Per-rental mutation locks prevent conflicting in-process actions.
Corrupt existing storage refuses startup and requires operator attention;
it must never be silently overwritten. Do not weaken these protections.

## Current Replit status: imported; deployment verification in progress

The user chose to investigate Replit instead of buying Render hosting. Replit
sign-in, an existing Core subscription, and available credits were verified.
FairHold was imported at https://replit.com/@iftiikhaarr/fairhold on 21 October.
Automatic Agent setup was stopped after five seconds. The imported revision is
`f2f518e8cc70e38ad64025a2d17bac153b958f2f`; its Linux CI passed 47 tests,
including real PostgreSQL 16 persistence and cross-process locks. The
development database is present. Production deployment has not yet been
verified. Render's
configuration remains an optional alternative; no paid FairHold Render service
was activated. There is no hosted FairHold URL or finished video yet.

Do not rebuild the product with Replit Agent. Import the existing repository
and make only necessary persistence, configuration, and deployment changes.
Check the user's agreed budget privately; no account billing details or keys
belong in this public document. Agent usage and hosting can consume credits.

## Immediate implementation work

1. Inspect Replit's current import, runtime, production database, secret, and
   deployment settings. Use its actual supported Node runtime and one exposed
   frontend/API origin. Prefer the existing `npm run build` and `npm start`
   single-server production flow; the Vite dev preview is not a deployed demo.
2. Replace or supplement `server/store.js` with durable production database
   storage before publishing real sandbox rentals. Its existing interface is
   synchronous, including `rentals`/`events` getters and mutation saves. A SQL
   driver is asynchronous: update callers and tests deliberately; do not simply
   replace a JSON write with an unawaited query. Confirm durable writes before
   returning successful API responses.
3. Preserve rental states, role-key hashes, event history, and idempotency
   results across restarts. Never migrate or erase the existing local sandbox
   records without an explicit reviewed plan. A new Replit workspace should
   begin with fresh synthetic rentals, not copied local private state.
4. Address concurrency for the chosen deployment. Current mutation locks and
   state cache assume one process. Do not enable multiple Autoscale instances
   with independent in-memory payment state. Choose an appropriate single-
   instance deployment or implement database-backed concurrency control and
   idempotency. Verify conflicting capture/release requests cannot race and
   completed retries reuse their recorded outcome.
5. Add tested Replit run/build/port configuration and update deployment docs.
   Keep local JSON mode available for credential-free setup where practical.
   In `server/index.js`, production currently requires FAIRHOLD_DATA_FILE;
   change that check appropriately when a database becomes supported. Do not
   merely point it at an ephemeral path to satisfy startup validation.
6. Configure secrets privately: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET must
   belong to a sandbox app; AI_API_KEY stays server-side. Keep
   DEMO_ACCESS_USER / DEMO_ACCESS_PASSWORD (24+ characters), NODE_ENV=production,
   and FAIRHOLD_APP_URL equal to the actual public HTTPS origin. Add the
   database's connection variable without logging its value. Never use VITE_
   for server secrets. The user's existing local `.env` is intentionally absent
   from GitHub; request secure entry if the new environment lacks credentials.
7. Run lint, unit/API tests, build, dependency audit, and protected production
   smoke. Add real database persistence/concurrency coverage. Verify a restart
   retains rental history and retries cannot duplicate a capture. Current
   `npm run smoke` deliberately disables external integrations; preserve this
   separation from real-provider tests.
8. Before activating a paid deployment, review its actual estimated cost and
   required account approvals. After publishing, test the protected HTTPS UI,
   static assets, actual PayPal callback/approval, real AI proposal, partial
   capture, and a separate full release. Record redacted statuses and IDs.
   Do not claim deployed verification from local or mocked checks.
9. Commit reviewed changes to GitHub, inspect the diff for credentials/private
   state, verify CI for the exact published commit, and record the hosted URL
   and any remaining limits in a current handoff.

## Recording and submission

VIDEO_BUILD_SCRIPT.md contains a 2:50 script covering setup/checks, hosting,
actual sandbox approval, actual model proposal, human decision, and receipt.
Record the real app; hide passwords, integration keys, and rental role keys.
Do not invent a hosted URL, video URL, or completed tests. The finished video
must be public on YouTube and shorter than three minutes under the supplied
rules. Re-check https://paypalaihackathon.devpost.com/rules before submission.

The rules permit a working hosted demo or complete setup/run access; Render
is optional. Using it only matters to its separate sponsor prizes. Keep public
source/open-source license and clear AI-assistance attribution. Novelty research
is provisional; no global first-ever claim is established.

Devpost remains a draft. The user intends to open it and give final submission
permission later. Do not submit now or make eligibility/ownership attestations
for the user. Prepare the complete entry and links for review first.

## Continuity

At each stopping point, save completed work, exact commit, checks and observed
results, hosted/import status, next actions, and blockers. Distinguish proposed,
mocked/local, real sandbox, and deployed evidence. Never include secrets in a
handoff. Browser sessions and private configuration do not transfer to another
AI just because it receives this document; ask for login only where necessary.
