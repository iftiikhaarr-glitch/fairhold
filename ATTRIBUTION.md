# Attribution record

Prepared 2026-10-18; updated 2026-10-21 for the PayPal AI Hackathon submission.

## Development assistance

This project's code, documentation, and test suite were drafted with AI
assistance (Kimi Work agent, Moonshot AI) acting on the entrant's
instructions, during the hackathon submission period. OpenAI Codex also
assisted with credential setup, debugging the checkout redirect and amount
handling, sandbox verification, regression tests, dependency remediation,
Tailwind migration, demo access controls, CI and deployment configuration,
recording scripts, and release documentation. The concept, product
decisions, and review remain the entrant's responsibility. The entrant must
review the Official Rules §4 (Intellectual Property / third-party assistance:
"Submission components are solely the Entrant's work product and the result
of the Entrant's ideas and creativity") and confirm they are comfortable
attesting to ownership before submitting. This record exists to make the
assistance transparent and reviewable. The ownership attestation is the
entrant's decision. Dependency remediation and release validation are recorded in
RELEASE_CHECK.md.

## Runtime dependencies (npm, see package-lock.json for exact versions)

| Package | License | Use |
|---|---|---|
| express (4.x) | MIT | HTTP API server |
| zod (4.x) | MIT | AI output schema validation |
| react / react-dom (19.x) | MIT | Frontend |
| react-router (7.x) | MIT | Frontend routing shell |
| tailwindcss (4.3) + @tailwindcss/vite + tailwindcss-animate | MIT | Styling and build integration |
| shadcn/ui component code (Radix UI primitives, class-variance-authority, clsx, tailwind-merge, lucide-react icons, sonner, etc.) | MIT (each) | UI components (vendored source pattern) |

Dev dependencies include Vite, TypeScript, ESLint, concurrently, PostCSS,
autoprefixer, and @types/*. The table summarizes principal dependencies; it
is not a complete transitive license audit. Preserve upstream license notices
when redistributing dependencies. The project source uses the included MIT license.

## External services

| Service | Terms | Use |
|---|---|---|
| PayPal Developer Platform — Orders v2, Payments v2, JS SDK (sandbox only) | PayPal Developer Agreement | Deposit hold / partial capture / void |
| OpenAI-compatible chat-completions API (provider and model via env config; default gpt-4o-mini) | Provider terms | Condition assessment |

## Sponsor tools

None used. No sponsor prize is claimed.

## Assets

All interface text, icons (lucide-react, MIT), and sample data are original
or permissively licensed. No stock photos, music, or third-party brand assets
ship with the project. Demo personas (Alex, Sam) and items are synthetic.

## Research sources (accessed 2026-10-18)

- PayPal Orders v2 API reference — https://developer.paypal.com/docs/api/orders/v2/
- PayPal Payments v2 API reference — https://developer.paypal.com/docs/api/payments/v2/
- PayPal authorize & capture integration guide — https://developer.paypal.com/docs/checkout/standard/customize/authorization/
- PayPal Agent Toolkit — https://github.com/paypal/agent-toolkit
- Swikly (competitor) — https://www.swikly.com/en
- Tractable (competitor) — https://tractable.ai/
- Splitwise (competitor) — https://www.splitwise.com/
- Deadline corroboration — hackathon listings on LinkedIn, thegenaimagazine.com, mlaiel.com (details in RESEARCH.md §1)
