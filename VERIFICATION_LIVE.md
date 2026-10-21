# External integration verification

Latest completed acceptance: **19 October 2026**. A real OpenAI proposal,
PayPal sandbox authorization, USD 18.50 final capture (COMPLETED), same-request
replay, separate full release (VOIDED), and cancellation were verified. The
post-capture authorization returned CAPTURED. There were 31 passing automated
tests and a passing production build after the corrections.

The chronological history below retains earlier failures and pending steps;
they describe the state at that time. The final two sections record the
completed external journey. Pending/declined outcomes were tested with mocks,
not induced externally. These are sandbox transactions, not live payments.

## Live AI verification — 2026-10-19T09:08:05.641Z

- Model: gpt-4o-mini @ https://api.openai.com/v1
- Result: FAILED — Proposed deduction 80.00 exceeds remaining hold 60.00


## Live AI verification — 2026-10-19T09:24:10.097Z

- Provider endpoint: https://api.openai.com/v1/chat/completions (real external call, not mocked)
- Model: gpt-4o-mini
- Latency: 3272 ms
- Result: OK — 2 item(s), total $35.00 within the $60.00 cap: true
- Evidence quotes verified verbatim against the source report: [true,true]
- Summary (model output, quoted): "The report suggests a long scratch on the rainfly and a dented pole, which are not part of the baseline condition."
- Prompt version: assessment.v1.3


## Follow-up verification — 2026-10-19

- Running API health confirmed PayPal sandbox and live AI modes.
- Clarified major-unit versus cent limits in assessment prompt v1.3; server-side over-limit rejection remains in place.
- Actual AI-provider verification passed: 2 proposal items, total USD 35.00 against USD 60.00 cap; both report quotations verified.
- Automated tests: 30 passed, 0 failed. Fixed integration-mode reporting to use the actual injected adapters, including in /api/config, rather than unrelated global credentials.
- Production client build passed.
- Browser successfully created actual PayPal sandbox order 5WJ93864UM1328930 for USD 60.00, AUTHORIZE intent. The rental remains awaiting buyer approval. No authorization or capture was performed.
- PayPal SDK loaded. The in-app browser did not expose the checkout popup after both the initial button and PayPal's recovery link; overlay closed. Buyer approval, partial capture, release, and reconciliation remain unverified against PayPal sandbox.
- The already-running API still has prompt v1.2 loaded; restart it to load the v1.3 changes before further acceptance testing.

## Redirect-checkout repair — 2026-10-19

- Buyer sign-in reached the funding-selection page for the previous $60 order, but continuing returned to login. A subsequent PayPal API read confirmed the order remained CREATED; no authorization or capture occurred.
- Found missing return/cancel configuration in the direct approval-link flow. Added payment_source.paypal.experience_context, retained AUTHORIZE intent, and support for PayPal's payer-action link. Added a popup-independent link and explicit server-verified approval check in the UI. Returned order tokens select the corresponding rental; they do not bypass role-key authorization.
- Added regression coverage for callback URLs and the payer-action link. Automated tests: 31 passed. Production build passed.
- Replaced unapproved acceptance orders. Current $60 order: 6FN75175CC335964U; $40 order: 08A4108949897204K. Cancellation-before-approval was verified on a third order. Buyer approval, capture, and release remain pending for these replacement orders.
- Source: https://developer.paypal.com/whats-an-order/

## Full sandbox acceptance — 2026-10-19T18:59:44.421Z

```json
{
  "verifiedAt": "2026-10-19T18:59:44.421Z",
  "promptVersion": "assessment.v1.3",
  "capture": {
    "rentalId": "57bf04e0-9f38-4f4b-93c9-e2bfa05b2fd5",
    "orderId": "6FN75175CC335964U",
    "authorizationId": "35S16742L8193271V",
    "captureId": "9J665627NR272220S",
    "status": "COMPLETED",
    "amount": "18.50",
    "authorizationStatus": "CAPTURED",
    "proposalTotal": "35.00",
    "evidenceVerified": true,
    "idempotentRetry": true
  },
  "release": {
    "rentalId": "a7de9e8f-0bc4-4785-9e30-4b2207ee4a6c",
    "orderId": "08A4108949897204K",
    "authorizationId": "2EH26435574273847",
    "state": "resolved_released"
  },
  "cancellation": true
}
```

## Final external confirmation — 2026-10-19

PayPal GET capture confirmed 9J665627NR272220S is COMPLETED, amount USD 18.50, final_capture=true. GET authorization 35S16742L8193271V returned CAPTURED. GET authorization 2EH26435574273847 independently returned VOIDED for the separate USD 40.00 release test. Simulation and static wording now distinguish a final capture (observed CAPTURED) from an explicit release (VOIDED). No funding-source release time is inferred.

After these corrections: 31 automated tests passed, and the production build passed. The sandbox redirect approval path, real-model assessment, partial capture, application retry protection, missing/wrong role rejection, over-limit rejection, full void, and pre-approval cancellation were exercised. Pending/declined outcomes remain mocked-test coverage only.
