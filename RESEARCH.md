# FairHold — research log and concept selection

Research date: **2026-10-18**. Researcher: Kimi Work agent (on behalf of the entrant).
This document separates **supplied requirements**, **independently verified facts**,
**assumptions**, and **recommendations**, as required by the project brief.

---

## 1. Requirements checklist (from the supplied Official Rules and overview)

### Dates (verified)
| Milestone | When (Pacific) | Source |
|---|---|---|
| Submission period | Oct 1, 2026 9:15 am – **Nov 12, 2026 12:00 pm (noon)** | Official Rules §1 (supplied) |
| Judging period | Dec 1, 2026 2:00 pm – Dec 15, 2026 8:00 am | Official Rules §1 (supplied) |
| Winners announced | on/around Dec 21, 2026 2:00 pm | Official Rules §1 (supplied) |

**Deadline verification (independent):** the Devpost overview attachment shows
"Nov 13, 2026 @ 12:00am GMT+4", which is the *same instant* as Nov 12, 12:00 PT.
Third-party coverage corroborates noon PT on Nov 12 (LinkedIn hackathon calendars,
thegenaimagazine.com, mlaiel.com). One aggregator (devgrantsdaily.com) stated
"2:00 p.m. Pacific" — that conflicts with the Rules; per Rules §11 the Official
Rules prevail. **Working deadline: Nov 12, 2026, 12:00 PT. Remaining build time
from 2026-10-18: 25 days.** Rules may be amended on the hackathon website;
re-check before submission.

### Eligibility (supplied; **not yet verified for the entrant**)
- Individual of age of majority, or team, or organization.
- Not resident in Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, or
  OFAC-sanctioned territories.
- Not a Promotion Entity employee/family/household, not a judge or judge's
  employer, no conflicts of interest.
- ☐ Entrant must confirm residency + eligibility before submission.

### Project requirements (supplied)
- Must meaningfully integrate the PayPal developer platform using the **free
  sandbox** (PayPal + AI both central). ✅ FairHold: authorize/void/capture is
  the core value, not a decorative button.
- Must integrate an AI tool/model of choice. ✅ FairHold: LLM condition
  assessment with structured output and validation.
- New project, or significantly updated during the submission period.
  ✅ FairHold is newly created (2026-10-18).
- Third-party SDKs/APIs must be used within their license terms. ✅ see
  ATTRIBUTION.md.
- Must install and run consistently; must function as depicted in the video.

### Submission materials (supplied)
- ☐ Public repo (GitHub/GitLab/Bitbucket) with source, assets, instructions.
- ☐ Open-source LICENSE file visible at repo top (MIT chosen — see LICENSE).
- ☐ Text description of features/functionality (see SUBMISSION.md).
- ☐ Functional demo: complete setup+run instructions (README) OR hosted URL.
- ☐ Demo video < 3 min, publicly visible on YouTube, no unlicensed third-party
  trademarks/music (see VIDEO_SCRIPT.md).
- ☐ Tools used: identified in the submission form (draft in SUBMISSION.md).
- ☐ Testing access free of charge through the end of the judging period
  (Dec 15, 2026 08:00 PT). Plan: repo run instructions + judge sandbox
  credential arrangements in README; no paid barrier.
- All materials in English. ✅

### Judging (supplied)
Stage 1 pass/fail: fits theme, reasonably applies required APIs.
Stage 2, equally weighted: Technological Implementation, Design, Potential
Impact, Innovation/Idea, Presentation.

### Sponsor prizes (supplied)
Optional sponsor tools: AG Grid, APIMatic, Astropods, Bryntum, Channel3,
Elastic, KERNEL, Postman, Render, Zapier. **Decision: target none initially.**
FairHold needs no sponsor tool to prove its value; adding one for prize
eligibility alone would violate the "earn its place" principle. Revisit only if
deployment to Render becomes the practical hosting path (Render prize = hosting
credits, requirements must be re-verified on the site before claiming).

---

## 2. Candidate concepts (six)

| # | Concept | User + recurring problem | Current workaround | Central PayPal function | Indispensable AI function | Memorable demo |
|---|---|---|---|---|---|---|
| 1 | SplitSmart — group gift pools with dynamic re-splitting | Friends pooling money for a gift; someone drops out, splits get recomputed | Splitwise + manual chasing | Per-contributor orders, capture when target reached | Recomputes fair splits, drafts chase messages | Dropout mid-demo, splits rebalanced live |
| 2 | MilestoneGuard — freelance milestone release with AI deliverable review | Client and freelancer arguing whether a deliverable meets the milestone spec | Upwork escrow / trust | Authorize at milestone start, capture on acceptance | Reviews deliverable text vs acceptance criteria, recommends release | Deliverable pasted, AI verdict, money moves |
| 3 | **FairHold — AI-mediated refundable deposits** | Anyone lending gear (camera, tent, tools) fears damage; cash deposits are awkward, card holds need terminals | Cash in an envelope; Swikly (B2B); platforms with built-in deposits | **Authorize hold → void or partial capture** at return | Reads return condition report, proposes itemized fair deduction with evidence | Scratch reported → AI proposes $18.50 of $60 → owner confirms → partial capture + auto-release of remainder |
| 4 | ScopeShield — freelance scope-creep change orders | Client asks for "one more thing" mid-project; unpaid scope creep | Polite emails, absorbed losses | Change-order payment before extra work starts | Detects out-of-scope asks vs original scope, drafts priced change order | Scope creep detected, client pays change order to continue |
| 5 | Buyer's Mandate — bounded agentic purchasing agent | People want AI agents to shop for them but won't hand over a card | Manual checkout; PayPal Agent Toolkit examples | Order create/approve/capture executed by an agent under constraints | Parses a natural-language mandate into budget/category constraints, ranks options | Agent buys within mandate, refuses out-of-mandate item |
| 6 | RefundRadar — price-drop refund claims | Shoppers miss price-adjustment windows | Manual tracking | Refund API on captured payments | Matches receipts to price drops, drafts claims | — weak: needs real transaction history access; rejected early |

### Why #1 and #6 were rejected before deep research
- #6 requires access to a payer's real transaction history; not demonstrable in
  sandbox and risks privacy claims. Rejected on feasibility.
- #1's differentiation is split *arithmetic* (rules handle it fine) and chasing
  (messaging); the AI is not indispensable, and group-collection apps are a
  crowded, generic space (Splitwise confirmed: expense tracking, no PayPal
  collection flow). Rejected on originality grounds in the brief (§2).

## 3. Deep research on the top three (2, 3, 5)

| Candidate | Closest alternatives found (2026-10-18) | Similarities | Differences / remaining gap |
|---|---|---|---|
| #3 FairHold | **Swikly** (swikly.com): online security deposits via card imprint for professionals (rentals, vehicles, equipment); partial or total collection "in a few clicks"; 18,000+ professionals, Europe-centric, subscription B2B. **Tractable** (tractable.ai): AI damage assessment from images for insurance claims and fleets. | Swikly = deposit holds + partial collection. Tractable = AI condition/damage assessment. | Swikly has **no AI adjudication** and is not PayPal-based; aimed at businesses, not peer lending. Tractable has **no payment flow** — it's claims tooling for insurers. The combination "PayPal authorize/void/partial-capture + AI-mediated itemized deduction with human authorization" was not found in any product or public hackathon project during this research window. Remaining uncertainty: web search was partially unavailable (search API outages); GitHub/Devpost archive search is marked **pending** — novelty claim stays provisional. |
| #2 MilestoneGuard | Upwork/Fiverr milestone escrow (platform-mediated, support page fetch blocked 403 — well-known market fact, unverified this session) | Escrow-style milestone release | AI deliverable review tied to capture is the novel bit; but "escrow-like freelance payments" is a heavily trodden hackathon theme, and authorization honor periods (3 days) fit rentals better than week-long milestones. |
| #5 Buyer's Mandate | **PayPal Agent Toolkit** (github.com/paypal/agent-toolkit, verified): official tooling that lets agent frameworks create orders/invoices/subscriptions via function calling. | Agent-initiated payments | The toolkit's existence means many entries will demo "agent creates an order". A mandate/constraint layer adds governance, but the risk of reading as "generic shopping agent + checkout" is high; the brief explicitly warns against that. |

### PayPal capability verification (independent, 2026-10-18)
- Orders v2: create order, authorize, capture endpoints exist.
  https://developer.paypal.com/docs/api/orders/v2/
- Payments v2: `POST /v2/payments/authorizations/{id}/capture` supports partial
  amounts + `final_capture`; `PayPal-Request-Id` header gives idempotency;
  over-capture returns `MAX_CAPTURE_AMOUNT_EXCEEDED`.
  https://developer.paypal.com/docs/api/payments/v2/
- Authorize & capture guide: authorization hold valid **29 days**, capture
  within the **3-day honor period**, reauthorize available; void endpoint
  exists; JS SDK `intent=authorize`.
  https://developer.paypal.com/docs/checkout/standard/customize/authorization/
- Consequence for FairHold: the demo runs within minutes, so honor-period
  limits are irrelevant; the README documents them for real-world use.

## 4. Selection against the judging criteria (planning estimates, not predictions)

| Criterion (equal weight) | #2 MilestoneGuard | #3 FairHold | #5 Buyer's Mandate |
|---|---|---|---|
| Technological Implementation | authorize/capture, but demo timeline fights the 3-day honor period | Full auth→void/partial-capture state machine + idempotency + AI validation; all sandbox-verifiable | Order create/capture only; simpler payment path |
| Design | B2B dashboard feel, two-persona friction | One linear 5-step journey, both personas in one screen | Chat-centric; hard to make feel like a product |
| Potential Impact | Real pain, crowded space | Clear consumer pain (P2P lending/rental deposits), credible and specific | Broad but vague; depends on merchant catalog realism |
| Innovation/Idea | "Escrow + AI review" — moderately novel | "AI-mediated deposit adjudication on PayPal holds" — no direct competitor found (provisional) | Crowded agentic-commerce field; toolkit provided by sponsor |
| Presentation | Needs scope docs, slower demo | 90-second, money visibly moves only after human-confirmed AI review | Visually strong but conceptually familiar |
| Build feasibility / risk | Medium | **High feasibility**: standard APIs only, no special permissions | Medium; catalog realism is the risk |

**Selected: #3 FairHold.**

## 5. FairHold — the concept

- **Name / pitch:** FairHold — *refundable deposits that resolve fairly: a
  PayPal hold at checkout, an AI-mediated deduction proposal at return, and a
  human-confirmed partial capture.*
- **Primary user & scenario:** Alex lends a camping tent to Sam and wants a
  $60 deposit without cash awkwardness. Sam approves a PayPal hold (not a
  charge). On return, the rainfly is scratched and a pole dented; FairHold's AI
  proposes an itemized $30 deduction with evidence; Alex adjusts to $18.50 and
  confirms; PayPal captures $18.50 and voids the remaining $41.50.
- **Differentiation:** no located product combines (a) consumer PayPal
  authorize/void/partial-capture deposit flows with (b) AI condition assessment
  producing itemized, evidence-cited deduction proposals under a hard
  human-authorization gate (research §3; provisional).
- **Why PayPal is essential:** the whole product *is* a payment state machine —
  hold, partial capture, void. Removing PayPal removes the product.
- **Why AI is essential:** free-text condition reports ("long scratch on the
  rainfly, pole dented") → itemized deductions mapped against the checkout
  baseline, with wear-and-tear excluded. Rules and forms handle this poorly;
  it is judgment over unstructured text.
- **What remains conventional/uncertain:** the rental marketplace shell is
  conventional; vision-based damage detection is future work; novelty is
  provisional pending deeper Devpost/GitHub archive search (search tooling was
  partially down on 2026-10-18).

## 6. MVP scope

**In:** create hold → renter approval (PayPal sandbox, intent=AUTHORIZE) →
return report → AI itemized assessment (validated, bounded) → owner
capture/release → receipt + audit timeline → demo reset → labeled fixture
fallbacks.
**Out:** multi-item rentals, disputes/messaging, image-based condition
analysis, payouts to owners, real-money mode, i18n, accounts/login (single
shared demo workspace), webhooks (sync API verification is used instead —
simpler and sufficient for the flow; noted in SPEC.md).

## 7. 60–90 second demo

Show: create tent hold ($60) → Sam approves in PayPal sandbox sheet → hold
active, $0 charged → return report ("scratch + dent") → AI proposes itemized
deduction with evidence → Alex edits to $18.50 → capture → receipt shows
$18.50 captured + $41.50 released + PayPal capture ID → audit timeline.

## 8. Riskiest assumption and first test

*Assumption:* the sandbox authorize → (partial capture | void) flow works
end-to-end with a sandbox buyer account, including the JS SDK `intent=authorize`
approval sheet.
*Test:* `server/test/paypal.test.js` verifies adapter semantics against mocked
API responses shaped like the real API; the first thing to do with real
credentials is the scripted journey in VERIFICATION.md (§ "real-sandbox
verification script") — one order, one authorize, one partial capture, one
void.

## 9. Assumptions made (per brief §1, no answers available)

One builder; browser-based app; minimal operational complexity; no new paid
commitments; entrant eligibility, residency, and ownership not yet verified;
AI assistance disclosure requirements followed via ATTRIBUTION.md.
