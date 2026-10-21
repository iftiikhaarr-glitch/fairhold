import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";
import { createSimulatedPayPal } from "../paypal.js";
import { createFixtureAI } from "../ai.js";

test("a failed durable commit never sends a successful rental creation response", async () => {
  const store = {
    mode: "postgres",
    async saveRental(rental) { return rental; },
    async appendEvent() {},
    async transaction(operation) {
      await operation();
      throw new Error("Deliberate test commit failure");
    },
  };
  const app = buildApp({ store, paypal: createSimulatedPayPal({ currency: "USD" }), ai: createFixtureAI(),
    config: { currency: "USD", paypal: { enabled: false }, ai: { maxReportChars: 4000 } } });
  let server;
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/rentals`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: "Tent", ownerName: "Alex", renterName: "Sam", checkoutCondition: "Intact", deposit: 60 }),
    });
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.rental, undefined);
    assert.equal(body.keys, undefined);
    assert.match(body.error.message, /commit failure/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
