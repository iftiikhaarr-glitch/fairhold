# FairHold video: build to payment outcome

Target **2:50**. This is a script, not a recorded video. Show the actual app
and outputs, sandbox payments, and a real model for integration scenes. Keep
ten seconds below the three-minute limit. Speak naturally; trim waiting time,
not product steps. This replaces the earlier product-only timing plan.

## Before recording

Follow `DEPLOYMENT.md`; get `npm run check` and `npm run smoke` passing. For a
hosted recording, complete its deployed acceptance checks first. If hosting
is unavailable, record and accurately label the local production server.
Never present localhost as a deployed website.

Sign in with the sandbox buyer before recording. Use synthetic personas and
a fresh sample rental. Hide `.env` values, demo passwords, role keys, password
entry, and personal account information. Use `.env.example` for setup footage.
Do not seed/reset existing sandbox records. No external photos or music are
needed. The actual YouTube upload and public playback check remain separate.

## Submission video

| Time | Actual shot | Spoken script |
|---|---|---|
| 0:00–0:15 | App title and sample tent | “Lending a tent is easy. Settling the deposit after a scratch is awkward. FairHold combines PayPal deposit holds with an AI-drafted proposal, while the owner makes the final decision.” |
| 0:15–0:35 | Repository README, `.env.example`, passing check output | “The repository includes reproducible setup. Install from the lockfile, configure PayPal sandbox and the AI provider on the server, then run the checks: lint, tests, production build, dependency advisories, and server startup.” |
| 0:35–0:50 | Actual hosted URL and badges; or labeled local production URL | **Hosted only:** “One Node service serves the interface and API over HTTPS. The judging demo has password protection and persistent storage. API secrets stay on the server.” **Local alternative:** “This recording uses the local production build. Server deployment configuration is included; hosted verification is still pending.” |
| 0:50–1:10 | Fill sample, create $60 hold, hide key handoff | “Alex records the tent's starting condition and requests a sixty-dollar deposit. Owner and renter receive separate role keys. Only the owner can capture or release the deposit.” |
| 1:10–1:30 | Signed-in sandbox approval, active hold | “Sam approves through PayPal's sandbox. The server verifies approval before activating the authorization. This is a hold, with no capture yet.” |
| 1:30–1:55 | Actual return report, model proposal and quote flags | “The return report describes a scratched rainfly and dented pole. The model proposes itemized amounts. The server checks the total against the hold and quoted evidence against the report. This is advice, not independent proof or a repair estimate.” |
| 1:55–2:20 | Owner sets $18.50, confirms capture | “Alex reviews the proposal and chooses eighteen dollars fifty. The server requires the owner key and rejects amounts above the hold. The model cannot initiate payment.” |
| 2:20–2:40 | Actual completed receipt and timeline | “The receipt shows PayPal's actual capture and authorization statuses. Repeating a completed decision returns the same capture. Pending results have a separate reconciliation path; they are never displayed as completed.” |
| 2:40–2:50 | App and repository link | “FairHold: PayPal authorizes and settles, AI drafts a bounded proposal, and a human decides. Source, setup, and verification records are in the repository.” |

Sample report: `Rainfly has a long scratch and one pole is dented. Stakes all returned.`
Record the actual model output, which can vary; then set the owner-confirmed
capture to $18.50. Show the actual authorization status: the previous verified
run returned `CAPTURED`, and a separate full-release test returned `VOIDED`.

## Optional longer technical walkthrough (separate video)

1. Open the project folder in PowerShell. Explain Node 24.15.0 and `npm ci`.
2. Show `.env.example`, naming integration variables without revealing values.
   Explain the separate sandbox buyer login and labeled fallbacks.
3. Run `npm run check`, then `npm run smoke`; distinguish automated test
   adapters from real external responses.
4. Explain `.replit`: build/start commands, one public port, HTTPS origin,
   production PostgreSQL, private server variables, and protected judging access.
   If no deployment has happened, describe it as proposed configuration.
5. Once deployed, show successful deploy status, protected app, actual sandbox
   approval, real proposal, and completed capture.
6. Explain persistence across restarts, provider usage controls, dependency
   alerts, and resolving/cancelling test holds individually.

## Recording checklist

- [ ] Actual repository URL and successful CI visible.
- [ ] Check output matches the recorded revision.
- [ ] Actual live-model and sandbox scenes, no fixture substitution.
- [ ] Hosted claims match completed checks, or local mode is stated.
- [ ] Secret values and rental keys hidden throughout.
- [ ] English audio/captions; runtime below three minutes.
- [ ] Public YouTube upload plays while signed out.
- [ ] Actual YouTube URL added to the submission draft.
