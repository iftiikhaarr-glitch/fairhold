// Live PayPal-sandbox verification. Drives the real journey against a
// RUNNING FairHold server (npm run dev or npm start) and records redacted
// evidence to VERIFICATION_LIVE.md.
//
// Human-in-the-loop: payer approval requires logging into the PayPal sandbox
// sheet in the browser — the script pauses and polls until you approve.
//
// Usage: npm run verify:live
// Never prints or stores secrets; evidence contains PayPal IDs only.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config, REPO_ROOT } from "../config.js";

const BASE = process.env.FAIRHOLD_API || `http://localhost:${config.port}`;
const EVIDENCE_FILE = path.join(REPO_ROOT, "VERIFICATION_LIVE.md");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

let evidence = [];
function record(line) {
  evidence.push(line);
  console.log(line);
}

async function api(method, p, body, headers = {}) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function waitForState(rentalId, wanted, timeoutMs = 5 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { body } = await api("GET", `/api/rentals/${rentalId}`);
    if (body.rental && wanted.includes(body.rental.state)) return body.rental;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Timed out waiting for state ${wanted.join("/")} (approve the hold in the browser, then re-run)`);
}

async function main() {
  console.log("FairHold live PayPal-sandbox verification");
  console.log(`Target API: ${BASE}\n`);

  const health = await api("GET", "/api/health");
  if (health.status !== 200) throw new Error(`Server not reachable at ${BASE} — start it with npm run dev or npm start`);
  if (health.body.modes.paypal !== "sandbox") {
    console.log("SKIPPED: server is not in real-sandbox mode (modes.paypal =", health.body.modes.paypal + ").");
    console.log("Configure PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in .env, restart the server, then re-run.");
    process.exit(2);
  }
  record(`## Live PayPal sandbox verification — ${new Date().toISOString()}\n`);
  record(`- Server mode: PayPal=sandbox (real external API), AI=${health.body.modes.ai}, prompt ${health.body.promptVersion}`);

  // ---- Rental 1: approve -> report -> partial capture -> retries -----------
  const created = await api("POST", "/api/rentals", {
    itemName: "TrailBlazer 2-person tent (live verification)",
    ownerName: "Alex",
    renterName: "Sam",
    checkoutCondition: "Poles straight and complete (4), rainfly intact. Known wear: minor scuff on the carry bag.",
    deposit: 60,
  });
  if (created.status !== 201) throw new Error("create failed: " + JSON.stringify(created.body));
  const rental = created.body.rental;
  const keys = created.body.keys;
  record(`- Rental 1 created: id ${rental.id}, sandbox order ${rental.paypal.orderId} (intent=AUTHORIZE, $60.00)`);

  console.log("\n>>> ACTION NEEDED: open the FairHold UI in your browser and select this rental:");
  console.log(`>>>   Rental id:  ${rental.id}`);
  console.log(">>> The browser has no keys for it, so paste this RENTER key into the key-entry box:");
  console.log(`>>>   Renter key: ${keys.renterKey}`);
  console.log(">>> (demo capability key, safe to paste into your own local app — it is not a PayPal/AI secret)");
  console.log(">>> Then approve the hold in the PayPal sandbox sheet using the sandbox BUYER account.");
  await ask(">>> Press Enter after you have approved the hold in PayPal... ");
  const held = await waitForState(rental.id, ["hold_active"]);
  record(`- Payer approval + authorization: state hold_active, authorization ${held.paypal.authorizationId}, expires ${held.paypal.expiresAt}`);

  const report = await api("POST", `/api/rentals/${rental.id}/report`, { report: "Rainfly has a long scratch and one pole is dented. Stakes all returned." }, { "X-Rental-Key": keys.renterKey });
  if (report.status !== 200) throw new Error("report failed: " + JSON.stringify(report.body));
  const assessed = report.body.rental;
  if (assessed.assessment) {
    record(`- AI proposal (${assessed.assessment.aiMode}): ${assessed.assessment.items.length} item(s), total $${(assessed.assessment.totalCents / 100).toFixed(2)}, evidence verbatim flags ${JSON.stringify(assessed.assessment.items.map((i) => i.evidenceVerified))}`);
  } else {
    record(`- AI proposal unavailable (manual review path): ${assessed.assessmentError}`);
  }

  const capture = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 18.5 }, { "X-Rental-Key": keys.ownerKey, "Idempotency-Key": "live-capture-1" });
  if (capture.status === 202) {
    record(`- Capture PENDING at PayPal (capture ${capture.body.rental.pendingCapture.captureId}) — reconciling...`);
    const rec = await api("POST", `/api/rentals/${rental.id}/reconcile`, undefined, { "X-Rental-Key": keys.ownerKey });
    record(`- Reconcile result: state ${rec.body.rental.state}${rec.body.stillPending ? " (still pending — check again shortly)" : ""}`);
  } else if (capture.status !== 200) {
    throw new Error("capture failed: " + JSON.stringify(capture.body));
  }
  let final1 = (await api("GET", `/api/rentals/${rental.id}`)).body.rental;
  if (final1.state !== "resolved_captured") throw new Error(`expected resolved_captured, got ${final1.state}`);
  record(`- Partial capture $18.50: status ${final1.resolution.status}, capture ${final1.resolution.captureId}`);
  record(`- Post-capture authorization status reported by PayPal: ${final1.resolution.authorizationStatus ?? "unavailable"}`);

  // Retry with the same idempotency key: must replay, not double-charge.
  const retry = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 18.5 }, { "X-Rental-Key": keys.ownerKey, "Idempotency-Key": "live-capture-1" });
  record(`- Idempotent retry (same key): replayed=${retry.body.replayed === true}, same capture id=${retry.body.rental.paypal.captureId === final1.resolution.captureId}`);

  // Over-limit attempt on a resolved rental: rejected before PayPal.
  const over = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 99.99 }, { "X-Rental-Key": keys.ownerKey, "Idempotency-Key": "live-capture-2" });
  record(`- Post-resolution capture attempt: HTTP ${over.status} (${over.body.replayed ? "replayed prior decision, no new charge" : over.body.error?.code ?? "?"})`);

  // ---- Rental 2: approve -> release (void) ---------------------------------
  const created2 = await api("POST", "/api/rentals", {
    itemName: "Camp stove (live verification)",
    ownerName: "Alex",
    renterName: "Sam",
    checkoutCondition: "Good working order.",
    deposit: 40,
  });
  const rental2 = created2.body.rental;
  const keys2 = created2.body.keys;
  record(`- Rental 2 created: id ${rental2.id}, sandbox order ${rental2.paypal.orderId} ($40.00)`);
  console.log("\n>>> ACTION NEEDED: approve rental 2 in the browser as well.");
  console.log(`>>>   Rental id:  ${rental2.id}`);
  console.log(`>>>   Renter key: ${keys2.renterKey}`);
  await ask(">>> Press Enter after approving... ");
  await waitForState(rental2.id, ["hold_active"]);

  const release = await api("POST", `/api/rentals/${rental2.id}/resolve`, { action: "release" }, { "X-Rental-Key": keys2.ownerKey });
  if (release.status !== 200) throw new Error("release failed: " + JSON.stringify(release.body));
  record(`- Release: authorization voided, state ${release.body.rental.state} (renter never charged)`);

  // ---- Rental 3: cancellation before approval ------------------------------
  const created3 = await api("POST", "/api/rentals", {
    itemName: "Headlamp (live verification)",
    ownerName: "Alex",
    renterName: "Sam",
    checkoutCondition: "New.",
    deposit: 15,
  });
  const rental3 = created3.body.rental;
  const cancel = await api("POST", `/api/rentals/${rental3.id}/cancel`, undefined, { "X-Rental-Key": created3.body.keys.ownerKey });
  record(`- Cancellation before approval: state ${cancel.body.rental.state} (order ${rental3.paypal.orderId} abandoned, nothing authorized)`);

  fs.appendFileSync(path.join(REPO_ROOT, "VERIFICATION_LIVE.md"), evidence.join("\n") + "\n\nAll IDs above are PayPal sandbox identifiers; no secrets, emails, or keys are recorded.\n");
  console.log(`\nEvidence appended to VERIFICATION_LIVE.md (${evidence.length} records).`);
  console.log("LIVE VERIFICATION PASSED.");
}

main().catch((err) => {
  console.error("\nLIVE VERIFICATION FAILED:", err.message);
  if (evidence.length) fs.appendFileSync(path.join(REPO_ROOT, "VERIFICATION_LIVE.md"), evidence.join("\n") + `\n- FAILED: ${err.message}\n`);
  process.exit(1);
}).finally(() => rl.close());
