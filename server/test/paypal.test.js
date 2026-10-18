import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulatedPayPal, createSandboxPayPal, PayPalError } from "../paypal.js";

test("simulated adapter enforces the same rules as the real API", async () => {
  const pp = createSimulatedPayPal({ currency: "USD" });
  const order = await pp.createDepositOrder({ amountCents: 6000, currency: "USD", description: "d", referenceId: "r1", idempotencyKey: "k1" });
  assert.equal(order.status, "CREATED");

  // Idempotent create: same key returns the same order.
  const again = await pp.createDepositOrder({ amountCents: 6000, currency: "USD", description: "d", referenceId: "r1", idempotencyKey: "k1" });
  assert.equal(again.orderId, order.orderId);

  const auth = await pp.authorizeOrder(order.orderId, {});
  assert.equal(auth.status, "COMPLETED");

  // Over-capture is rejected like PayPal's MAX_CAPTURE_AMOUNT_EXCEEDED.
  await assert.rejects(
    () => pp.captureAuthorization(auth.authorizationId, { amountCents: 7000 }),
    (err) => err instanceof PayPalError && err.code === "MAX_CAPTURE_AMOUNT_EXCEEDED"
  );

  const cap = await pp.captureAuthorization(auth.authorizationId, { amountCents: 2500 });
  assert.equal(cap.status, "COMPLETED");
  assert.equal(cap.amount.value, "25.00");

  // Capture replay with the same idempotency key does not double-capture.
  const orderR = await pp.createDepositOrder({ amountCents: 6000, currency: "USD", description: "d", referenceId: "r-replay" });
  const authR = await pp.authorizeOrder(orderR.orderId, {});
  const capReplay = await pp.captureAuthorization(authR.authorizationId, { amountCents: 2500, idempotencyKey: "cap-1" });
  const capReplay2 = await pp.captureAuthorization(authR.authorizationId, { amountCents: 2500, idempotencyKey: "cap-1" });
  assert.equal(capReplay.captureId, capReplay2.captureId);
  // A genuinely new capture attempt after a final capture must fail:
  // final_capture voided the authorization (documented behavior).
  await assert.rejects(
    () => pp.captureAuthorization(authR.authorizationId, { amountCents: 100, idempotencyKey: "cap-2" }),
    (err) => err.code === "AUTHORIZATION_VOIDED"
  );

  // Void after capture is rejected.
  await assert.rejects(() => pp.voidAuthorization(auth.authorizationId, {}), (err) => err.code === "AUTHORIZATION_CAPTURED");

  // Void flow on a fresh authorization works.
  const order2 = await pp.createDepositOrder({ amountCents: 1000, currency: "USD", description: "d", referenceId: "r2" });
  const auth2 = await pp.authorizeOrder(order2.orderId, {});
  const v = await pp.voidAuthorization(auth2.authorizationId, {});
  assert.equal(v.voided, true);
  await assert.rejects(
    () => pp.captureAuthorization(auth2.authorizationId, { amountCents: 100 }),
    (err) => err.code === "AUTHORIZATION_VOIDED"
  );
});

test("simulated adapter reports post-capture authorization truth", async () => {
  const pp = createSimulatedPayPal({ currency: "USD" });
  const order = await pp.createDepositOrder({ amountCents: 5000, currency: "USD", description: "d", referenceId: "r" });
  const auth = await pp.authorizeOrder(order.orderId, {});

  // Partial capture with final capture semantics: authorization becomes
  // VOIDED (documented final_capture behavior); getCapture/getAuthorization
  // expose the truth instead of local arithmetic.
  const cap = await pp.captureAuthorization(auth.authorizationId, { amountCents: 2000 });
  assert.equal(cap.status, "COMPLETED");
  const authAfter = await pp.getAuthorization(auth.authorizationId);
  assert.equal(authAfter.status, "VOIDED");
  const capAfter = await pp.getCapture(cap.captureId);
  assert.equal(capAfter.status, "COMPLETED");
  assert.equal(capAfter.amount.value, "20.00");

  // A PENDING outcome does not move money and stays reconcilable.
  const order2 = await pp.createDepositOrder({ amountCents: 5000, currency: "USD", description: "d", referenceId: "r2" });
  const auth2 = await pp.authorizeOrder(order2.orderId, {});
  pp._forceNextCaptureStatus("PENDING");
  const pending = await pp.captureAuthorization(auth2.authorizationId, { amountCents: 1000 });
  assert.equal(pending.status, "PENDING");
  const authDuring = await pp.getAuthorization(auth2.authorizationId);
  assert.equal(authDuring.status, "CREATED", "pending capture leaves the hold untouched");
  pp._setCaptureStatus(pending.captureId, "COMPLETED");
  const capFinal = await pp.getCapture(pending.captureId);
  assert.equal(capFinal.status, "COMPLETED");
  const authFinal = await pp.getAuthorization(auth2.authorizationId);
  assert.equal(authFinal.status, "VOIDED");
});

test("sandbox adapter caches tokens and sends PayPal-Request-Id", async () => {
  const requests = [];
  const fetchImpl = async (url, opts) => {
    requests.push({ url, opts });
    if (url.endsWith("/v1/oauth2/token")) {
      return { ok: true, json: async () => ({ access_token: "TOKEN-1", expires_in: 3600 }) };
    }
    return {
      ok: true,
      json: async () => ({
        id: "ORDER-1",
        status: "CREATED",
        links: [{ rel: "approve", href: "https://sandbox.paypal.com/checkoutnow?token=ORDER-1" }],
      }),
    };
  };
  const pp = createSandboxPayPal({ clientId: "id", clientSecret: "secret", baseUrl: "https://api-m.sandbox.paypal.com", fetchImpl });
  await pp.createDepositOrder({ amountCents: 1000, currency: "USD", description: "x", referenceId: "r", idempotencyKey: "order-r" });
  await pp.createDepositOrder({ amountCents: 2000, currency: "USD", description: "x", referenceId: "r2", idempotencyKey: "order-r2" });

  const tokenCalls = requests.filter((r) => r.url.endsWith("/v1/oauth2/token"));
  assert.equal(tokenCalls.length, 1, "token is cached across calls");

  const orderCall = requests.find((r) => r.url.endsWith("/v2/checkout/orders"));
  assert.equal(orderCall.opts.headers["PayPal-Request-Id"], "order-r");
  assert.equal(orderCall.opts.headers.Authorization, "Bearer TOKEN-1");
  const body = JSON.parse(orderCall.opts.body);
  assert.equal(body.intent, "AUTHORIZE");
  assert.equal(body.purchase_units[0].amount.value, "10.00");
});

test("sandbox adapter maps PayPal error bodies to PayPalError", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return { ok: true, json: async () => ({ access_token: "T", expires_in: 3600 }) };
    }
    return {
      ok: false,
      status: 422,
      json: async () => ({
        name: "UNPROCESSABLE_ENTITY",
        message: "The requested action could not be completed.",
        debug_id: "dbg-1",
        details: [{ issue: "MAX_CAPTURE_AMOUNT_EXCEEDED" }],
      }),
    };
  };
  const pp = createSandboxPayPal({ clientId: "id", clientSecret: "s", baseUrl: "https://api-m.sandbox.paypal.com", fetchImpl });
  await assert.rejects(
    () => pp.captureAuthorization("AUTH-1", { amountCents: 99999 }),
    (err) =>
      err instanceof PayPalError &&
      err.status === 422 &&
      err.debugId === "dbg-1" &&
      err.details[0].issue === "MAX_CAPTURE_AMOUNT_EXCEEDED"
  );
});
