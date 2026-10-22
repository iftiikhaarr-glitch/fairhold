# Replit status — 22 October 2026

This status supersedes the original checklist in REPLIT_HANDOFF.md.

- Published app: https://fairhold.replit.app/
- Project: https://replit.com/@iftiikhaarr/fairhold
- Reviewed runtime: `eafa0410588150e367c0642357f016aaaf3633be`.
- [CI](https://github.com/iftiikhaarr-glitch/fairhold/actions/runs/39755812186)
  passed 49 tests including real PostgreSQL 16, lint, build, zero-finding audit,
  and protected startup smoke. Replit passed 43 tests with its database CI
  suite explicitly skipped, plus lint/build/audit/smoke.
- Replit deployment build `60e1c85b-3b70-4e82-a919-bbf61632352b` is live.
  Its checkpoint `6a826089a9d1f5b5732f08ab40db3f51d15632f3` has the same source
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

## Hosted integration results — 22 October

Hosted capture/release verification completed successfully. The original
unapproved checkout became unavailable overnight (`INVALID_RESOURCE_ID` from
PayPal). Those unapproved local records were cancelled; fresh synthetic $60
and $40 orders were created. A separate pre-approval cancellation succeeded.
The user signed into the fresh checkout, and approval returned to the actual
hosted origin. The verified outcomes are:

- $60 authorization `43E13350TW0867231`.
- Real model proposal $35.00, two items, both quotation matches verified.
- Owner-confirmed $18.50 capture `0DP41918HN8876100`: COMPLETED, final capture;
  PayPal reported authorization status CAPTURED. No remainder release is inferred.
- Same-key retry returned the same capture; missing/renter keys returned 403,
  over-limit amount returned 400, and reset returned 409.
- Separate $40 authorization `17L72039E42510049` released; a direct PayPal read
  confirmed VOIDED.

Post-capture redeployment/replay verification passed after the final publish:
both terminal outcomes, event history, and the original capture ID persisted.
No second capture occurred. A browser review also corrected nested sidebar
grid sizing for long rental names and verified it locally before publishing.
Keep database copying disabled on future redeploys. Preserve redacted evidence
and keep rental keys private.

Private local verification helpers and judging access exist only in the
operator's workspace, outside this public repository. The user need not paste
passwords or provider keys into chat. A future operator needs appropriate
project access and private configuration to continue.

The 2:50 recording script is in VIDEO_BUILD_SCRIPT.md. A finished public video
has not been recorded/uploaded here. Devpost submission awaits the user's
later explicit authorization; do not make eligibility or ownership attestations
for them. Historical real external tests remain in VERIFICATION_LIVE.md and
remain distinct from the hosted evidence in VERIFICATION_HOSTED.md.
