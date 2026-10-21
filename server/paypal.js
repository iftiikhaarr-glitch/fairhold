// PayPal integration: one interface, two adapters.
//
// - "sandbox":  real calls against https://api-m.sandbox.paypal.com using
//   Orders v2 (intent=AUTHORIZE) + Payments v2 (capture / void).
// - "simulated": an in-process stand-in used ONLY when no credentials are
//   configured, so the workflow stays exercisable. It enforces the same
//   rules (no capture above the authorized amount, no void after capture)
//   and is visibly labeled as simulated in the UI and /api/health.
//
// Verified against official docs (2026-10-18):
// - Orders v2:    https://developer.paypal.com/docs/api/orders/v2/
// - Payments v2:  https://developer.paypal.com/docs/api/payments/v2/
// - Auth+capture: https://developer.paypal.com/docs/checkout/standard/customize/authorization/
//   (authorization valid 29 days; capture within the 3-day honor period;
//   PayPal-Request-Id header provides idempotency)
import { randomUUID } from "node:crypto";
import { centsToMoney } from "./machine.js";

export class PayPalError extends Error {
  constructor(message, { status = 502, code = "PAYPAL_ERROR", debugId = null, details = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.debugId = debugId;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Real sandbox adapter
// ---------------------------------------------------------------------------

export function createSandboxPayPal({ clientId, clientSecret, baseUrl, appBaseUrl = "http://localhost:3000", fetchImpl = fetch }) {
  let token = null;
  let tokenExpiresAt = 0;

  async function getToken() {
    if (token && Date.now() < tokenExpiresAt - 60_000) return token;
    const res = await fetchImpl(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new PayPalError("PayPal authentication failed", { status: 502, code: "AUTH_FAILURE" });
    const data = await res.json();
    token = data.access_token;
    tokenExpiresAt = Date.now() + Number(data.expires_in || 300) * 1000;
    return token;
  }

  async function call(method, path, { body, idempotencyKey } = {}) {
    const accessToken = await getToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    // Server-side idempotency for every payment mutation.
    if (idempotencyKey) headers["PayPal-Request-Id"] = idempotencyKey;
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new PayPalError(data.message || `PayPal request failed (${res.status})`, {
        status: res.status === 422 ? 422 : 502,
        code: data.name || "PAYPAL_ERROR",
        debugId: data.debug_id || null,
        details: data.details || null,
      });
    }
    return data;
  }

  function findAuthorization(order) {
    for (const unit of order.purchase_units || []) {
      const auths = unit?.payments?.authorizations || [];
      if (auths.length) return auths[0];
    }
    return null;
  }

  return {
    mode: "sandbox",

    async createDepositOrder({ amountCents, currency, description, referenceId, idempotencyKey }) {
      const order = await call("POST", "/v2/checkout/orders", {
        idempotencyKey: idempotencyKey || `order-${referenceId}`,
        body: {
          intent: "AUTHORIZE",
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "FairHold",
                shipping_preference: "NO_SHIPPING",
                user_action: "CONTINUE",
                return_url: new URL("/?paypal_return=1", appBaseUrl).href,
                cancel_url: new URL("/?paypal_cancel=1", appBaseUrl).href,
              },
            },
          },
          purchase_units: [
            {
              reference_id: referenceId,
              description: (description || "Refundable deposit hold").slice(0, 127),
              amount: { currency_code: currency, value: centsToMoney(amountCents) },
            },
          ],
        },
      });
      const approve = (order.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
      return { orderId: order.id, status: order.status, approveLink: approve ? approve.href : null };
    },

    async authorizeOrder(orderId, { idempotencyKey } = {}) {
      const order = await call("POST", `/v2/checkout/orders/${orderId}/authorize`, {
        idempotencyKey: idempotencyKey || `auth-${orderId}`,
        body: {},
      });
      const auth = findAuthorization(order);
      if (!auth) throw new PayPalError("Authorization missing from PayPal response", { code: "AUTH_MISSING" });
      return {
        orderId: order.id,
        status: order.status,
        authorizationId: auth.id,
        authorizationStatus: auth.status,
        expiresAt: auth.expiration_time || null,
      };
    },

    async captureAuthorization(authorizationId, { amountCents, currency, note, idempotencyKey }) {
      const capture = await call("POST", `/v2/payments/authorizations/${authorizationId}/capture`, {
        idempotencyKey: idempotencyKey || `capture-${authorizationId}`,
        body: {
          amount: { currency_code: currency, value: centsToMoney(amountCents) },
          final_capture: true,
          note_to_payer: (note || "Deposit resolution").slice(0, 255),
        },
      });
      return {
        captureId: capture.id,
        status: capture.status,
        statusDetails: capture.status_details || null,
        amount: capture.amount || null,
      };
    },

    async voidAuthorization(authorizationId, { idempotencyKey } = {}) {
      // Verified 2026-10-18 (PayPal v1→v2 migration guide): void returns
      // 204 No Content by default; there is no body to parse.
      await call("POST", `/v2/payments/authorizations/${authorizationId}/void`, {
        idempotencyKey: idempotencyKey || `void-${authorizationId}`,
        body: {},
      });
      return { voided: true };
    },

    async getAuthorization(authorizationId) {
      const auth = await call("GET", `/v2/payments/authorizations/${authorizationId}`);
      return { id: auth.id, status: auth.status, amount: auth.amount || null, expiresAt: auth.expiration_time || null };
    },

    async getCapture(captureId) {
      const capture = await call("GET", `/v2/payments/captures/${captureId}`);
      return {
        id: capture.id,
        status: capture.status,
        statusDetails: capture.status_details || null,
        amount: capture.amount || null,
        finalCapture: capture.final_capture ?? null,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Simulated adapter (clearly labeled; same rules as the real thing)
// ---------------------------------------------------------------------------

export function createSimulatedPayPal({ currency = "USD" } = {}) {
  const orders = new Map();
  const authorizations = new Map();
  const captures = new Map();
  const idem = new Map();
  // Test hook: force the outcome of the next capture ("PENDING", "DECLINED", ...).
  let forcedCaptureStatus = null;

  const replay = (key, make) => {
    if (key && idem.has(key)) return idem.get(key);
    const value = make();
    if (key) idem.set(key, value);
    return value;
  };

  return {
    mode: "simulated",

    async createDepositOrder({ amountCents, description, referenceId, idempotencyKey }) {
      return replay(idempotencyKey, () => {
        const orderId = "SIM-ORDER-" + randomUUID().slice(0, 13).toUpperCase();
        orders.set(orderId, {
          id: orderId,
          status: "CREATED",
          intent: "AUTHORIZE",
          amountCents,
          currency,
          description,
          referenceId,
        });
        return { orderId, status: "CREATED", approveLink: null };
      });
    },

    async authorizeOrder(orderId, { idempotencyKey } = {}) {
      return replay(idempotencyKey, () => {
        const order = orders.get(orderId);
        if (!order) throw new PayPalError("Simulated order not found", { status: 404, code: "RESOURCE_NOT_FOUND" });
        if (order.status === "VOIDED") throw new PayPalError("Order was voided", { status: 422, code: "ORDER_VOIDED" });
        const authorizationId = "SIM-AUTH-" + randomUUID().slice(0, 13).toUpperCase();
        order.status = "COMPLETED";
        authorizations.set(authorizationId, {
          id: authorizationId,
          orderId,
          amountCents: order.amountCents,
          currency: order.currency,
          status: "CREATED",
          capturedCents: 0,
          expiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
        });
        return {
          orderId,
          status: "COMPLETED",
          authorizationId,
          authorizationStatus: "CREATED",
          expiresAt: authorizations.get(authorizationId).expiresAt,
        };
      });
    },

    async captureAuthorization(authorizationId, { amountCents, idempotencyKey, __forceStatus } = {}) {
      return replay(idempotencyKey, () => {
        const auth = authorizations.get(authorizationId);
        if (!auth) throw new PayPalError("Authorization not found", { status: 404, code: "RESOURCE_NOT_FOUND" });
        if (auth.status === "VOIDED")
          throw new PayPalError("Authorization was voided", { status: 422, code: "AUTHORIZATION_VOIDED" });
        if (auth.status === "CAPTURED")
          throw new PayPalError("Authorization was finalized by a capture", { status: 422, code: "AUTHORIZATION_CAPTURED" });
        if (amountCents > auth.amountCents - auth.capturedCents)
          throw new PayPalError("Capture amount exceeds authorized amount", {
            status: 422,
            code: "MAX_CAPTURE_AMOUNT_EXCEEDED",
          });
        const status = __forceStatus || forcedCaptureStatus || "COMPLETED";
        forcedCaptureStatus = null;
        const capture = {
          id: "SIM-CAPTURE-" + randomUUID().slice(0, 13).toUpperCase(),
          authorizationId,
          amountCents,
          currency: auth.currency,
          status,
          statusDetails: status === "PENDING" ? { reason: "PENDING_REVIEW" } : status === "DECLINED" ? { reason: "DECLINED_BY_SIMULATION" } : null,
        };
        captures.set(capture.id, capture);
        if (status === "COMPLETED") {
          auth.capturedCents += amountCents;
          // Match the authorization status observed after a real sandbox
          // partial final capture on 2026-10-19. An explicit void remains VOIDED.
          auth.status = "CAPTURED";
        }
        return {
          captureId: capture.id,
          status: capture.status,
          statusDetails: capture.statusDetails,
          amount: { currency_code: auth.currency, value: centsToMoney(amountCents) },
        };
      });
    },

    async getAuthorization(authorizationId) {
      const auth = authorizations.get(authorizationId);
      if (!auth) throw new PayPalError("Authorization not found", { status: 404, code: "RESOURCE_NOT_FOUND" });
      return {
        id: auth.id,
        status: auth.status,
        amount: { currency_code: auth.currency, value: centsToMoney(auth.amountCents) },
        expiresAt: auth.expiresAt,
      };
    },

    async getCapture(captureId) {
      const capture = captures.get(captureId);
      if (!capture) throw new PayPalError("Capture not found", { status: 404, code: "RESOURCE_NOT_FOUND" });
      return {
        id: capture.id,
        status: capture.status,
        statusDetails: capture.statusDetails,
        amount: { currency_code: capture.currency, value: centsToMoney(capture.amountCents) },
        finalCapture: true,
      };
    },

    // ---- test hooks (used by server/test only) ----
    _forceNextCaptureStatus(status) {
      forcedCaptureStatus = status;
    },
    _setCaptureStatus(captureId, status) {
      const capture = captures.get(captureId);
      if (!capture) throw new Error("capture not found");
      capture.status = status;
      if (status === "COMPLETED") {
        const auth = authorizations.get(capture.authorizationId);
        auth.capturedCents += capture.amountCents;
        auth.status = "CAPTURED";
      }
    },

    async voidAuthorization(authorizationId, { idempotencyKey } = {}) {
      return replay(idempotencyKey, () => {
        const auth = authorizations.get(authorizationId);
        if (!auth) throw new PayPalError("Authorization not found", { status: 404, code: "RESOURCE_NOT_FOUND" });
        if (auth.capturedCents > 0)
          throw new PayPalError("Cannot void a captured authorization", { status: 422, code: "AUTHORIZATION_CAPTURED" });
        auth.status = "VOIDED";
        const order = orders.get(auth.orderId);
        if (order) order.status = "VOIDED";
        return { voided: true };
      });
    },
  };
}

export function createPayPal(config) {
  return config.paypal.enabled
    ? createSandboxPayPal(config.paypal)
    : createSimulatedPayPal({ currency: config.currency });
}
