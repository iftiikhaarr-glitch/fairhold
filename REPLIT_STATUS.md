# Replit status — 22 October 2026

This status supersedes the original checklist in REPLIT_HANDOFF.md.

- Published app: https://fairhold.replit.app/
- Project: https://replit.com/@iftiikhaarr/fairhold
- Reviewed runtime: `2675da2f85e91cf75002909c8f485c40bec2b712`.
- [CI](https://github.com/iftiikhaarr-glitch/fairhold/actions/runs/39588960180)
  passed 49 tests including real PostgreSQL 16, lint, build, zero-finding audit,
  and protected startup smoke. Replit passed 43 tests with its database CI
  suite explicitly skipped, plus lint/build/audit/smoke.
- Replit deployment build `7424400b-1db8-4571-bd27-8774afd999ef` is live.
  Its checkpoint `0a338772709825acddda18b134ea192019b9e403` has the same source
  tree as the reviewed runtime. Replit creates empty publishing checkpoints;
  inspect them and rebase before pulling later source updates rather than
  discarding changes or forcing remote history.
- Runtime is Node 22.22, one Autoscale machine maximum, 1 vCPU / 0.5 GiB RAM.
  PostgreSQL is a separate production database. On redeploy, **Copy your
  development database to production database** was left unchecked.
- With specific user approval, sandbox PayPal credentials, OpenAI key, and a
  private demo password were saved in this app's Replit Secrets. No secret
  values are in this repository or its archive. No paid Render was activated.
- Public health reports PostgreSQL, sandbox PayPal and live AI. Unauthenticated
  page/API access returns 401; authenticated built HTML/JS/CSS return 200.
- Browser sign-in was verified at the actual hosted URL. It uses an eight-hour
  signed HttpOnly/Secure/SameSite=Lax session cookie; API scripts may use Basic.
  A hosted check verified cookie API access, cross-site write refusal, sign-out,
  and survival of existing production rental records after redeployment.

## Integration verification remaining

Hosted capture/release verification is **not yet complete**. The original
unapproved checkout became unavailable overnight (`INVALID_RESOURCE_ID` from
PayPal). Those unapproved local records were cancelled; fresh synthetic $60
and $40 orders were created. A separate pre-approval cancellation succeeded.
The user was asked to log in to the fresh $60 sandbox checkout. Do not retry
the old order. If the fresh order also expires before approval, inspect its
state and replace only unapproved records; do not discard active holds.

After sandbox login: finish payer approval, verify authorization through the
hosted API, submit the sample report to the real model, have the owner confirm
$18.50, record actual capture/authorization statuses, and check replay and role
refusals. Approve the separate $40 order and verify full void. Then republish
without copying development data and verify terminal records, event history,
and replay persist. Preserve all redacted evidence; keep rental keys private.

Private local verification helpers and judging access exist only in the
operator's workspace, outside this public repository. The user need not paste
passwords or provider keys into chat. A future operator needs appropriate
project access and private configuration to continue.

The 2:50 recording script is in VIDEO_BUILD_SCRIPT.md. A finished public video
has not been recorded/uploaded here. Devpost submission awaits the user's
later explicit authorization; do not make eligibility or ownership attestations
for them. Historical real external tests remain in VERIFICATION_LIVE.md and
must not be confused with the pending hosted payment checks.
