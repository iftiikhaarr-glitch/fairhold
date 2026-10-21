# Demo video — script and shot list

**Updated recording plan:** use `VIDEO_BUILD_SCRIPT.md` for the build,
configuration, deployment, and product walkthrough. The earlier product-only
timing below is retained as reference.

Target runtime **2:40** (limit 3:00; judges aren't required to watch beyond
that). All footage must be the actual running application. No copyrighted
music or third-party brand assets beyond the product under demonstration;
PayPal UI shown is part of the integration being judged. Voiceover in
English; captions recommended.

> Real sandbox and live-model verification completed on 2026-10-19; see
> VERIFICATION_LIVE.md. The video has not been recorded. Record the actual
> running app, using sandbox transactions and a real model. Hide role keys,
> API secrets, passwords, and personal account information throughout.

| # | Time | Shot | Voiceover / on-screen action |
|---|---|---|---|
| 1 | 0:00–0:15 | Simple text title over the running app | "Meet Alex, lending a tent to Sam. Alex wants a deposit — without the cash-envelope awkwardness. This is FairHold." |
| 2 | 0:15–0:35 | Screen recording: create hold + key handoff | Fill sample scenario: tent, baseline condition, $60 deposit. Click *Create PayPal hold*. Hide or blur the owner/renter key values. "FairHold creates a PayPal order with intent=AUTHORIZE — a hold, not a charge — and protects who can move money with role keys." |
| 3 | 0:35–0:55 | PayPal sandbox approval sheet | Start with the sandbox buyer already signed in; approve. Do not record password entry. UI flips to *hold active*. "Sam approves in PayPal's sandbox. Sixty dollars held. Zero dollars charged." |
| 4 | 0:55–1:20 | Return report + AI proposal | Type: "Rainfly has a long scratch and one pole is dented." Click *Run AI condition review*. Show the itemized proposal: line items, verbatim-quote badges, confidence, prompt version. "The AI drafts an itemized proposal from the report — every quote checked against what was actually submitted. It's advice, not proof; the amounts are illustrative." |
| 5 | 1:20–1:45 | Owner decision | Edit the actual proposed amount to 18.50, click *Capture deduction*. "The AI proposes. The human — holding the owner key — decides. The server caps the amount at the authorized hold and recomputes everything itself." |
| 6 | 1:45–2:10 | Receipt + audit timeline | Receipt: $18.50 captured, verified COMPLETED, PayPal capture ID, authorization status **CAPTURED as actually reported by PayPal**. Scroll the audit timeline. "Only outcomes PayPal actually confirms make it onto the receipt. Every step is on the record." |
| 7 | 2:10–2:25 | Safety shots (quick cuts) | Show an actual over-limit rejection before resolving, then the verified replay of the same successful capture. Use the app or a redacted test result; label test output clearly. "The server rejects an amount above the hold. Repeating this completed request returns the same capture. Pending and declined outcomes have separate automated tests." |
| 8 | 2:25–2:40 | Closing card | "FairHold — refundable deposits that resolve fairly. PayPal holds the money. AI drafts the proposal. A human makes the call. Built on the PayPal sandbox with an OpenAI-compatible model." |

## Recording checklist

- [ ] `.env` configured with real sandbox + AI credentials; header badges show
      "PayPal sandbox · live" and "AI model · live".
- [ ] `npm run dev`, a fresh sample rental ready. Preserve previous evidence;
      reset stored demo data only if intentionally discarding those rentals.
- [ ] Sandbox buyer credentials at hand for the approval sheet.
- [ ] Screen recorder (e.g. OBS) at 1080p; browser zoom ~110% for legibility.
- [ ] No music, or royalty-free/CC0 only; no third-party logos besides the
      demonstrated PayPal flow.
- [ ] Upload to YouTube as **public**; title "FairHold — PayPal AI Hackathon";
      paste the link into the Devpost submission form.
