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
let clock = Date.now();
const authorization = `Basic ${Buffer.from("judge:local-test-demo-password").toString("base64")}`;
before(async () => {
  paypal = createSimulatedPayPal({ currency: "USD" });
  // A sandbox-mode test double verifies reset protection without any network.
  paypal.mode = "sandbox";
  store = createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fairhold-access-")), "data.json"));
  const app = buildApp({
    store,
    paypal, ai: createFixtureAI(),
    config: { currency: "USD", demo: { username: "judge", password: "local-test-demo-password", now: () => clock }, paypal: { enabled: false, appBaseUrl: "https://demo.example.test" }, ai: { maxReportChars: 4000 } },
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
    if (route === "/") {
      assert.equal(response.headers.get("www-authenticate"), null);
      assert.match(await response.text(), /Sign in to demo/);
    } else assert.match(response.headers.get("www-authenticate"), /^Basic /);
  }
});

test("web sign-in creates a secure expiring session, preserves checkout query and refuses forged cookies", async () => {
  const login = await fetch(base + "/demo/login", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://demo.example.test" }, body: new URLSearchParams({ username: "judge", password: "local-test-demo-password", returnTo: "/?token=sandbox-order" }) });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get("location"), "/?token=sandbox-order");
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
  assert.equal(cookie.includes("local-test-demo-password"), false);
  const session = cookie.split(";")[0];
  assert.equal((await fetch(base + "/api/rentals", { headers: { Cookie: session } })).status, 200);
  const forged = session.replace(/.$/, c => c === "a" ? "b" : "a");
  assert.equal((await fetch(base + "/api/rentals", { headers: { Cookie: forged } })).status, 401);
  assert.equal((await fetch(base + "/api/demo/reset", { method: "POST", headers: { Cookie: session, Origin: "https://untrusted.example.test" } })).status, 403);
  const logout = await fetch(base + "/demo/logout", { method: "POST", redirect: "manual", headers: { Cookie: session, Origin: "https://demo.example.test" } });
  assert.equal(logout.status, 303); assert.match(logout.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  clock += 8 * 60 * 60 * 1000 + 1;
  try { assert.equal((await fetch(base + "/api/rentals", { headers: { Cookie: session } })).status, 401); }
  finally { clock -= 8 * 60 * 60 * 1000 + 1; }
});

test("login rejects wrong passwords, cross-site submissions and external return destinations", async () => {
  async function login(password, origin, returnTo) {
    return fetch(base + "/demo/login", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin }, body: new URLSearchParams({ username: "judge", password, returnTo }) });
  }
  const wrong = await login("wrong", "https://demo.example.test", "/");
  assert.equal(wrong.status, 401); assert.equal(wrong.headers.get("set-cookie"), null);
  assert.equal((await login("local-test-demo-password", "https://untrusted.example.test", "/")).status, 403);
  const external = await login("local-test-demo-password", "https://demo.example.test", "//untrusted.example.test");
  assert.equal(external.status, 303); assert.equal(external.headers.get("location"), "/");
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
