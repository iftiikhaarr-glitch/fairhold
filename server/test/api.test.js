// End-to-end API tests. These exercise the whole core journey against the
// SIMULATED PayPal adapter and FIXTURE AI (clearly labeled fallbacks).
// Real-sandbox and live-model verification steps are documented in
// VERIFICATION.md and require credentials.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { buildApp } from "../app.js";
import { createStore } from "../store.js";
import { createSimulatedPayPal } from "../paypal.js";
import { createFixtureAI } from "../ai.js";

let server;
let base;
let storeFile;
let paypal;

const config = {
  currency: "USD",
  port: 0,
  paypal: { enabled: false, clientId: null },
  ai: { maxReportChars: 4000 },
};

async function api(method, p, body, headers = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function createRental(deposit = 60) {
  const { status, body } = await api("POST", "/api/rentals", {
    itemName: "TrailBlazer 2-person tent",
    ownerName: "Alex (owner)",
    renterName: "Sam (renter)",
    checkoutCondition: "Poles straight, rainfly intact, minor scuff on the bag already noted.",
    deposit,
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.ok(body.keys?.ownerKey && body.keys?.renterKey, "role keys returned once at creation");
  assert.equal(body.rental.auth, undefined, "key hashes are never serialized");
  return { rental: body.rental, keys: body.keys };
}

const owner = (keys) => ({ "X-Rental-Key": keys.ownerKey });
const renter = (keys) => ({ "X-Rental-Key": keys.renterKey });

async function toUnderReview(deposit = 60) {
  const { rental, keys } = await createRental(deposit);
  await api("POST", `/api/rentals/${rental.id}/authorize`, undefined, renter(keys));
  const rep = await api(
    "POST",
    `/api/rentals/${rental.id}/report`,
    { report: "Rainfly has a long scratch and one pole is dented. Otherwise clean." },
    renter(keys)
  );
  assert.equal(rep.status, 200, JSON.stringify(rep.body));
  return { rental: rep.body.rental, keys };
}

before(async () => {
  storeFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fairhold-test-")), "data.json");
  const store = createStore(storeFile);
  paypal = createSimulatedPayPal({ currency: "USD" });
  const app = buildApp({ store, paypal, ai: createFixtureAI(), config });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

test("health reports labeled integration modes", async () => {
  const { status, body } = await api("GET", "/api/health");
  assert.equal(status, 200);
  assert.deepEqual(body.modes, { paypal: "simulated", ai: "fixture" });
});

test("input validation rejects bad rentals", async () => {
  const r1 = await api("POST", "/api/rentals", { itemName: "", ownerName: "a", renterName: "b", checkoutCondition: "", deposit: 60 });
  assert.equal(r1.status, 400);
  const r2 = await api("POST", "/api/rentals", { itemName: "x", ownerName: "a", renterName: "b", checkoutCondition: "", deposit: 10000 });
  assert.equal(r2.status, 400);
  const r3 = await api("POST", "/api/rentals", { itemName: "x", ownerName: "a", renterName: "b", checkoutCondition: "", deposit: -5 });
  assert.equal(r3.status, 400);
});

test("core journey: create -> authorize -> proposal -> partial capture", async () => {
  const { rental, keys } = await toUnderReview(60);
  assert.equal(rental.state, "under_review");
  assert.equal(rental.assessment.aiMode, "fixture");
  assert.ok(rental.assessment.totalCents > 0);
  assert.ok(rental.assessment.totalCents <= 6000);
  // Fixture quotes a verbatim window of the report: evidence verifies.
  assert.ok(rental.assessment.items.every((i) => i.evidenceVerified === true));

  const proposed = rental.assessment.totalCents / 100;
  const res1 = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: proposed }, { "Idempotency-Key": "decision-1", ...owner(keys) });
  assert.equal(res1.status, 200, JSON.stringify(res1.body));
  assert.equal(res1.body.rental.state, "resolved_captured");
  assert.equal(res1.body.rental.resolution.amountCents, Math.round(proposed * 100));
  assert.equal(res1.body.rental.resolution.status, "COMPLETED");
  assert.equal(res1.body.rental.resolution.finalCapture, true);
  // Remainder truth comes from the authorization lookup, not subtraction.
  assert.equal(res1.body.rental.resolution.authorizationStatus, "VOIDED");
  assert.ok(res1.body.rental.paypal.captureId);

  // Retried request with the same key replays; no second capture.
  const res2 = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: proposed }, { "Idempotency-Key": "decision-1", ...owner(keys) });
  assert.equal(res2.status, 200);
  assert.equal(res2.body.replayed, true);
  assert.equal(res2.body.rental.paypal.captureId, res1.body.rental.paypal.captureId);

  // Audit timeline exists and is ordered.
  const detail = await api("GET", `/api/rentals/${rental.id}`);
  const types = detail.body.events.map((e) => e.type);
  assert.deepEqual(types, ["created", "order_created", "authorized", "report_submitted", "proposal_created", "captured"]);
});

test("PENDING capture parks the rental in attention; reconcile completes it", async () => {
  const { rental, keys } = await toUnderReview(50);
  paypal._forceNextCaptureStatus("PENDING");
  const res1 = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 12 }, owner(keys));
  assert.equal(res1.status, 202, JSON.stringify(res1.body));
  assert.equal(res1.body.rental.state, "attention");
  assert.equal(res1.body.pending, true);
  assert.equal(res1.body.rental.pendingCapture.status, "PENDING");
  assert.equal(res1.body.rental.resolution, null, "no confirmed outcome is shown for a pending capture");

  // Still pending: reconcile reports stillPending.
  const res2 = await api("POST", `/api/rentals/${rental.id}/reconcile`, undefined, owner(keys));
  assert.equal(res2.status, 200);
  assert.equal(res2.body.stillPending, true);

  // PayPal-side completion: reconcile finalizes with verified truth.
  paypal._setCaptureStatus(res1.body.rental.pendingCapture.captureId, "COMPLETED");
  const res3 = await api("POST", `/api/rentals/${rental.id}/reconcile`, undefined, owner(keys));
  assert.equal(res3.status, 200, JSON.stringify(res3.body));
  assert.equal(res3.body.rental.state, "resolved_captured");
  assert.equal(res3.body.rental.resolution.status, "COMPLETED");
  assert.equal(res3.body.rental.resolution.amountCents, 1200);
  assert.equal(res3.body.rental.resolution.authorizationStatus, "VOIDED");
});

test("PENDING capture that later fails returns the rental to review", async () => {
  const { rental, keys } = await toUnderReview(50);
  paypal._forceNextCaptureStatus("PENDING");
  const res1 = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 10 }, owner(keys));
  assert.equal(res1.status, 202);
  paypal._setCaptureStatus(res1.body.rental.pendingCapture.captureId, "DECLINED");
  const res2 = await api("POST", `/api/rentals/${rental.id}/reconcile`, undefined, owner(keys));
  assert.equal(res2.body.captureFailed, true);
  assert.equal(res2.body.rental.state, "under_review");
  assert.equal(res2.body.rental.resolution, null, "no money moved; nothing is marked resolved");
});

test("DECLINED capture is an error, not a resolution", async () => {
  const { rental, keys } = await toUnderReview(50);
  paypal._forceNextCaptureStatus("DECLINED");
  const res = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 10 }, owner(keys));
  assert.equal(res.status, 502);
  assert.equal(res.body.error.code, "CAPTURE_NOT_COMPLETED");
  const after = await api("GET", `/api/rentals/${rental.id}`);
  assert.equal(after.body.rental.state, "under_review");
  assert.equal(after.body.rental.resolution, null);
});

test("role keys protect payment-changing endpoints", async () => {
  const { rental, keys } = await toUnderReview(40);

  // No key, wrong key, renter key: all forbidden for owner actions.
  for (const headers of [{}, { "X-Rental-Key": "deadbeef" }, renter(keys)]) {
    const res = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 5 }, headers);
    assert.equal(res.status, 403, JSON.stringify(headers));
  }
  // Renter key cannot authorize either (that's the renter's own action).
  const authByOwner = await api("POST", `/api/rentals/${rental.id}/authorize`, undefined, owner(keys));
  assert.equal(authByOwner.status, 403);
  // Owner cannot cancel without owner key; renter key is rejected.
  const cancelByRenter = await api("POST", `/api/rentals/${rental.id}/cancel`, undefined, renter(keys));
  assert.equal(cancelByRenter.status, 403);
  // Report accepts either role; unauthenticated is rejected.
  const anon = await api("POST", `/api/rentals/${rental.id}/report`, { report: "scratch" });
  assert.equal(anon.status, 403);
});

test("manipulated capture amount above the hold is rejected server-side", async () => {
  const { rental, keys } = await toUnderReview(60);
  const res = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 99.99 }, owner(keys));
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "AMOUNT_EXCEEDS_HOLD");
});

test("release voids the authorization and is terminal", async () => {
  const { rental, keys } = await createRental(45);
  await api("POST", `/api/rentals/${rental.id}/authorize`, undefined, renter(keys));
  const res = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "release" }, owner(keys));
  assert.equal(res.status, 200);
  assert.equal(res.body.rental.state, "resolved_released");
  const again = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 10 }, owner(keys));
  assert.equal(again.status, 200);
  assert.equal(again.body.replayed, true);
  assert.equal(again.body.rental.state, "resolved_released");
});

test("invalid transitions are rejected with 409", async () => {
  const { rental, keys } = await createRental(30);
  const res = await api("POST", `/api/rentals/${rental.id}/report`, { report: "scratch" }, renter(keys));
  assert.equal(res.status, 409);
  const res2 = await api("POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 5 }, owner(keys));
  assert.equal(res2.status, 409);
});

test("cancel before approval does not require an authorization", async () => {
  const { rental, keys } = await createRental(30);
  const res = await api("POST", `/api/rentals/${rental.id}/cancel`, undefined, owner(keys));
  assert.equal(res.status, 200);
  assert.equal(res.body.rental.state, "cancelled");
});

test("oversized condition report is rejected", async () => {
  const { rental, keys } = await createRental(30);
  await api("POST", `/api/rentals/${rental.id}/authorize`, undefined, renter(keys));
  const res = await api("POST", `/api/rentals/${rental.id}/report`, { report: "x".repeat(5000) }, renter(keys));
  assert.equal(res.status, 400);
});

test("persistence survives a store reload (restart behavior)", async () => {
  const { rental } = await createRental(25);
  const { createStore: freshStore } = await import("../store.js");
  const reloaded = freshStore(storeFile);
  const found = reloaded.findRental(rental.id);
  assert.equal(found.itemName, "TrailBlazer 2-person tent");
  // Hashes persist, plaintext keys never do.
  assert.ok(found.auth.ownerKeyHash);
});

test("demo reset clears all state", async () => {
  const res = await api("POST", "/api/demo/reset");
  assert.equal(res.status, 200);
  const list = await api("GET", "/api/rentals");
  assert.equal(list.body.rentals.length, 0);
});
