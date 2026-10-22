# Hosted FairHold verification

Host: https://fairhold.replit.app

- 2026-10-21T10:58:34.984Z: HTTPS health reports PostgreSQL, real PayPal sandbox and live AI; unauthenticated page/API return 401; authenticated built HTML and 2 assets return 200.
- Created $60 capture-path order 529836836B0630315, $40 release-path order 67535126SC508400U; a third order was cancelled before approval.
- The original unapproved checkout expired (PayPal INVALID_RESOURCE_ID). Its local records were cancelled without a capture; fresh orders were created for verification.
- Hosted web sign-in returns a Secure, HttpOnly, SameSite=Lax session cookie; cookie-authenticated API access succeeds, cross-site writes return 403, sign-out clears the cookie. Existing production rental records survived the sign-in update deployment.
- Hosted $60 authorization confirmed: 43E13350TW0867231.
- Hosted live model proposal: $35.00, 2 items, quotation verification flags [true,true].
- Owner-confirmed $18.50 capture 0DP41918HN8876100: COMPLETED; post-capture authorization status CAPTURED. Retry replayed the same capture. Missing/renter role keys returned 403, over-limit returned 400, reset returned 409.
- Separate hosted $40 authorization 17L72039E42510049 was released; direct PayPal read confirmed VOIDED.
- After a verified Replit redeployment, capture/release records and event history persisted; retry still returned capture 0DP41918HN8876100.

Sandbox only. Pending/declined exceptional outcomes remain regression-tested, not induced external cases.
