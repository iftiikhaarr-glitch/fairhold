import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPostgresStore } from "../postgres-store.js";
import { buildApp } from "../app.js";
import { createSimulatedPayPal } from "../paypal.js";
import { createFixtureAI } from "../ai.js";

const connectionString = process.env.TEST_DATABASE_URL;
test("real PostgreSQL persistence and multi-process decision boundaries", { skip: !connectionString }, async t => {
  const stores = [], servers = [];
  async function repository() {
    const store = await createPostgresStore({ connectionString });
    stores.push(store);
    return store;
  }
  const paypal = createSimulatedPayPal({ currency: "USD" });
  const config = { currency: "USD", paypal: { enabled: false }, ai: { maxReportChars: 4000 } };
  async function serve(store) {
    const app = buildApp({ store, paypal, ai: createFixtureAI(), config });
    let server;
    await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function request(base, method, route, body, headers = {}) {
    const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const owner = keys => ({ "X-Rental-Key": keys.ownerKey });
  async function review(base) {
    const created = await request(base, "POST", "/api/rentals", { itemName: "Database-test tent", ownerName: "Alex", renterName: "Sam", checkoutCondition: "Intact", deposit: 60 });
    assert.equal(created.status, 201);
    const { rental, keys } = created.body;
    const approved = await request(base, "POST", `/api/rentals/${rental.id}/authorize`, undefined, { "X-Rental-Key": keys.renterKey });
    assert.equal(approved.status, 200);
    const report = await request(base, "POST", `/api/rentals/${rental.id}/report`, { report: "The pole is dented and the rainfly has a scratch." }, owner(keys));
    assert.equal(report.status, 200);
    return { rental: report.body.rental, keys };
  }
  try {
    // Initialization is also serialized, even when two processes start together.
    const [a, b] = await Promise.all([repository(), repository()]);
    await t.test("transactions roll back complete state and release advisory locks", async () => {
      const id = randomUUID();
      await assert.rejects(a.withRentalLock(id, async () => {
        await a.saveRental({ id, state: "test" });
        await a.appendEvent({ id: randomUUID(), rentalId: id, type: "rolled_back" });
        throw new Error("rollback-test");
      }), /rollback-test/);
      assert.equal(await b.findRental(id), null);
      assert.deepEqual(await b.eventsFor(id), []);
      assert.equal(await b.withRentalLock(id, async () => "released"), "released");
    });
    await t.test("rentals, ordered events, hashes and immutable replay survive reopening", async () => {
      const id = randomUUID();
      await a.transaction(async () => {
        await a.saveRental({ id, createdAt: new Date().toISOString(), auth: { ownerKeyHash: "hash-only" } });
        await a.appendEvent({ id: randomUUID(), rentalId: id, type: "first", at: "same-time" });
        await a.appendEvent({ id: randomUUID(), rentalId: id, type: "second", at: "same-time" });
        await a.idempotencySet("test", id, { captureId: "original" });
      });
      const reopened = await repository();
      assert.equal((await reopened.findRental(id)).auth.ownerKeyHash, "hash-only");
      assert.deepEqual((await reopened.eventsFor(id)).map(event => event.type), ["first", "second"]);
      await reopened.idempotencySet("test", id, { captureId: "replacement" });
      assert.equal((await reopened.idempotencyGet("test", id)).captureId, "original");
    });
    const baseA = await serve(a), baseB = await serve(b);
    await t.test("two independent app instances cannot race capture against release", async () => {
      const { rental, keys } = await review(baseA);
      const original = paypal.captureAuthorization;
      let unblock, started;
      const gate = new Promise(resolve => { unblock = resolve; });
      const entered = new Promise(resolve => { started = resolve; });
      let calls = 0;
      paypal.captureAuthorization = async (...args) => { calls++; started(); await gate; return original(...args); };
      let first;
      try {
        first = request(baseA, "POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 18.50 }, { ...owner(keys), "Idempotency-Key": "pg-capture" });
        await entered;
        const conflict = await request(baseB, "POST", `/api/rentals/${rental.id}/resolve`, { action: "release" }, owner(keys));
        assert.equal(conflict.status, 409);
        assert.equal(conflict.body.error.code, "OPERATION_IN_PROGRESS");
        unblock();
        const completed = await first;
        assert.equal(completed.status, 200);
        assert.equal(calls, 1);
        const restarted = await serve(await repository());
        const replay = await request(restarted, "POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 18.50 }, { ...owner(keys), "Idempotency-Key": "pg-capture" });
        assert.equal(replay.status, 200);
        assert.equal(replay.body.replayed, true);
        assert.equal(replay.body.rental.paypal.captureId, completed.body.rental.paypal.captureId);
        assert.equal(calls, 1);
      } finally { unblock(); if (first) await first; paypal.captureAuthorization = original; }
    });
    await t.test("pending reconciliation is persisted for another app instance", async () => {
      const { rental, keys } = await review(baseA);
      paypal._forceNextCaptureStatus("PENDING");
      const pending = await request(baseA, "POST", `/api/rentals/${rental.id}/resolve`, { action: "capture", amount: 12 }, owner(keys));
      assert.equal(pending.status, 202);
      paypal._setCaptureStatus(pending.body.rental.pendingCapture.captureId, "COMPLETED");
      const reconciled = await request(baseB, "POST", `/api/rentals/${rental.id}/reconcile`, undefined, owner(keys));
      assert.equal(reconciled.status, 200);
      const saved = await a.findRental(rental.id);
      assert.equal(saved.state, "resolved_captured");
      assert.equal(saved.pendingCapture, null);
      assert.equal(saved.resolution.amountCents, 1200);
    });
    await t.test("database-backed reset is refused and role hashes never leave the API", async () => {
      const reset = await request(baseA, "POST", "/api/demo/reset");
      assert.equal(reset.status, 409);
      const rentals = await request(baseB, "GET", "/api/rentals");
      assert.equal(rentals.status, 200);
      assert.ok(rentals.body.rentals.every(rental => rental.auth === undefined));
    });
  } finally {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    await Promise.all(stores.map(store => store.close()));
  }
});
