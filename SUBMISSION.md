# Devpost submission copy — draft (English)

> Status: draft, updated 2026-10-18 after the round-2 audit. All claims are
> grounded in implemented behavior (see VERIFICATION.md). Real-sandbox and
> live-model evidence must be added once credentials are configured; do not
> submit before the checkboxes in VERIFICATION.md are closed.

## Project name

FairHold

## Elevator pitch

Refundable deposits that resolve fairly: a PayPal hold at checkout, an
AI-drafted deduction proposal at return, and a human-confirmed partial
capture.

## Inspiration

Lending things is broken by awkward deposits. Cash in an envelope is
impractical; card holds need terminals; marketplace platforms only work
inside their own walls. Meanwhile the return conversation — "is this scratch
worth $10 or $40?" — is judgment over messy descriptions. PayPal's
authorize-and-capture model can hold money without charging it, and modern AI
is good at drafting structured judgment from unstructured text. FairHold puts
the two together: the money waits safely on PayPal, and the fairness
conversation starts from an itemized, evidence-quoted proposal — with a human
always making the final call.

## Target audience

People who lend or rent out gear peer-to-peer — camera owners, campers,
tool-library organizers, hobbyist clubs — and small rental operators who
don't have card-hold infrastructure.

## What it does

1. The owner lists an item, records its baseline condition, and sets a
   deposit amount. FairHold issues per-rental owner/renter keys.
2. The renter approves a **PayPal authorization hold** (sandbox in the demo).
   No money moves.
3. When the item comes back, either party files a free-text condition report.
4. FairHold's AI drafts an **itemized deduction proposal** from the report —
   each line with an amount and a verbatim quote from the report (the server
   verifies the quote actually appears). Normal wear recorded at checkout is
   never deducted. The proposal is hard-bounded by the authorized hold, and
   the server recomputes every total. The proposal is advisory: not
   independent proof of damage, and the amounts are illustrative, not
   verified repair costs.
5. The **owner reviews and decides** (owner key required): capture the
   confirmed deduction (PayPal captures exactly that amount; per PayPal's
   documented final-capture behavior the authorization is voided and the
   remainder released) or release the hold in full.
6. Both sides get a truthful receipt — capture ID, verified COMPLETED status,
   and the authorization status as reported by PayPal — plus a complete audit
   timeline. Pending captures are reconciled with PayPal, never assumed.

## How it was built

- **Frontend:** React + TypeScript + Vite + Tailwind + shadcn/ui; PayPal JS
  SDK with `intent=authorize` for the approval sheet.
- **Backend:** Node + Express. A pure, unit-tested deposit state machine; a
  PayPal adapter (Orders v2 + Payments v2, sandbox); an AI adapter; JSON
  persistence with atomic writes; money as integer cents.
- **PayPal integration:** `intent=AUTHORIZE` orders; partial capture with
  `final_capture: true` sent explicitly (v2 defaults it to false); void for
  releases; capture statuses checked explicitly — only COMPLETED resolves,
  PENDING is reconciled via the captures API, DECLINED/FAILED stay
  reviewable; `PayPal-Request-Id` idempotency plus application-level replay
  protection; over-capture attempts rejected server-side.
- **AI integration:** OpenAI-compatible chat completions in JSON mode with a
  versioned prompt (`assessment.v1.2`); zod schema + business-rule validation;
  verbatim evidence-quote verification against the source report; timeout,
  retry, bounded inputs; prompt-injection hardening; failures route to manual
  review, never to a guessed number. The model has no payment tools and no
  secrets in context.
- **Security (demo grade):** per-rental owner/renter capability keys protect
  payment-changing endpoints; only key hashes are stored; secrets stay
  server-side. (Roadmap: accounts/OAuth before public deployment.)

## Meaningful PayPal + AI usage

PayPal is not a checkout button here — it is the product. The entire value is
the hold/partial-capture/void/reconcile lifecycle. AI is not a chatbot here —
its structured, verified output shapes a money decision, under validation and
a human authorization gate.

## Differentiation

Closest alternatives researched (2026-10-18, RESEARCH.md §3): Swikly manages
deposit holds for professionals via card imprints — no AI assistance, not
PayPal. Tractable does AI damage assessment for insurance claims — no payment
flow. PayPal's own Agent Toolkit lets agents create orders — but generic
"agent buys something" demos don't help two people settle a deposit fairly.
FairHold's specific combination — consumer PayPal holds + an AI-drafted,
evidence-verified deduction proposal + a human-confirmed partial capture —
was not found in products or public hackathon projects during research
(novelty claim provisional; see RESEARCH.md).

## Challenges

- Getting payment semantics exactly right: authorization ≠ capture accepted ≠
  capture completed; `final_capture` defaults inverting between API versions;
  honoring idempotency so a retried click can never charge twice; showing
  only outcomes PayPal actually reported.
- Making the AI safe and honest around money: the model proposes, the server
  validates, recomputes, and verifies quotes, the human disposes. Over-limit
  or malformed AI output falls back to manual review.
- Honest demo modes: when credentials are absent the app still runs
  end-to-end, but every simulated payment and fixture AI output is visibly
  labeled.

## Accomplishments

- A complete, working hold → AI proposal → partial capture/void journey with
  a real state machine, not a mockup — including pending-capture
  reconciliation and role-key-protected payment endpoints.
- 30 automated tests covering the money rules, capture statuses, AI
  validation and quote verification, role enforcement, idempotency replay,
  and the full API journey.
- An audit trail a renter could actually use to contest a charge.

## Lessons

Payment integrations fail at the edges — retries, cancellations, pending
captures, expired authorizations — so the state machine, status checks, and
idempotency deserve more attention than the happy path. And AI around money
needs boring engineering: schemas, bounds, verified quotes, and human gates
beat clever prompts.

## Limitations and next steps

Current limits: sandbox-only payments; demo-grade role keys rather than
accounts; demo-scale JSON storage; sync verification + manual reconcile
instead of webhooks; text-only condition reports; AI proposals are advisory
and based solely on submitted reports. Next steps: PayPal webhook
verification with signature checks; image-based condition input; accounts and
per-user scoping; dispute messaging; multi-item holds.

## Tools, models, services

PayPal Developer Platform (Orders v2, Payments v2, JS SDK — sandbox);
OpenAI-compatible LLM API (provider/model configurable, default gpt-4o-mini —
endpoint and capabilities verified against OpenAI docs 2026-10-18); Node.js,
Express, React, Vite, Tailwind CSS, shadcn/ui, zod. No sponsor tools used.
Full inventory and licenses: ATTRIBUTION.md. AI assistance used in
development: disclosed in ATTRIBUTION.md.
