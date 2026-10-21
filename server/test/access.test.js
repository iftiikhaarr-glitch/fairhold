import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../app.js";
import { createStore } from "../store.js";
import { createSimulatedPayPal } from "../paypal.js";
import { createFixtureAI } from "../ai.js";

let server, base, paypal, store;
const authorization = `Basic ${Buffer.from("judge:local-test-demo-password").toString("base64")}`;
before(async () => {
  paypal = createSimulatedPayPal({ currency: "USD" });
  // A sandbox-mode test double verifies reset protection without any network.
  paypal.mode = "sandbox";
  store = createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fairhold-access-")), "data.json"));
  const app = buildApp({
    store,
    paypal, ai: createFixtureAI(),
    config: { currency: "USD", demo: { username: "judge", password: "local-test-demo-password" }, paypal: { enabled: false, appBaseUrl: "https://demo.example.test" }, ai: { maxReportChars: 4000 } },
  });
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

test("unauthenticated hosting health check exposes no credentials", async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});
test("demo access protects the page, rental data, and mutations", async () => {
  for (const [method, route] of [["GET", "/"], ["GET", "/api/rentals"], ["POST", "/api/demo/reset"]]) {
    const response = await fetch(base + route, { method });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate"), /^Basic /);
  }
});
test("wrong or malformed access credentials do not unlock the API", async () => {
  for (const header of ["Bearer invalid", "Basic !!!", `Basic ${Buffer.from("judge:wrong").toString("base64")}`]) {
    assert.equal((await fetch(`${base}/api/rentals`, { headers: { Authorization: header } })).status, 401);
  }
});
test("correct demo access allows reads without leaking the password", async () => {
  const response = await fetch(`${base}/api/config`, { headers: { Authorization: authorization } });
  assert.equal(response.status, 200);
  const content = await response.text();
  assert.equal(content.includes("local-test-demo-password"), false);
  assert.equal(JSON.parse(content).canResetDemo, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("cross-site writes are blocked even with demo access", async () => {
  const response = await fetch(`${base}/api/demo/reset`, { method: "POST", headers: { Authorization: authorization, Origin: "https://untrusted.example.test" } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "CROSS_SITE_WRITE");
});
test("sandbox reset is refused instead of discarding PayPal records", async () => {
  const response = await fetch(`${base}/api/demo/reset`, { method: "POST", headers: { Authorization: authorization, Origin: "https://demo.example.test" } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "RESET_DISABLED");
});

test("removing sandbox credentials does not enable erasing existing sandbox records", async () => {
  store.saveRental({ id: "persisted-sandbox-record", paypal: { mode: "sandbox" } });
  paypal.mode = "simulated";
  try {
    const response = await fetch(`${base}/api/demo/reset`, { method: "POST", headers: { Authorization: authorization } });
    assert.equal(response.status, 409);
    assert.ok(store.findRental("persisted-sandbox-record"));
  } finally { paypal.mode = "sandbox"; }
});
