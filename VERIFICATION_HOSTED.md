# Hosted FairHold verification

Host: https://fairhold.replit.app

- 2026-10-21T10:58:34.984Z: HTTPS health reports PostgreSQL, real PayPal sandbox and live AI; unauthenticated page/API return 401; authenticated built HTML and 2 assets return 200.
- Created $60 capture-path order 529836836B0630315, $40 release-path order 67535126SC508400U; a third order was cancelled before approval.
- The original unapproved checkout expired (PayPal INVALID_RESOURCE_ID). Its local records were cancelled without a capture; fresh orders were created for verification.
- Hosted web sign-in returns a Secure, HttpOnly, SameSite=Lax session cookie; cookie-authenticated API access succeeds, cross-site writes return 403, sign-out clears the cookie. Existing production rental records survived the sign-in update deployment.

Sandbox only. Pending/declined exceptional outcomes remain regression-tested, not induced external cases.
