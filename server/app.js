// Express application factory. Deps are injected so tests can run the full
// API against the simulated PayPal adapter and fixture AI on an ephemeral
// port.
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { REPO_ROOT } from "./config.js";
import { assertTransition, canTransition, centsToMoney, dollarsToCents, isTerminal, TransitionError } from "./machine.js";
import { PROMPT_VERSION } from "./ai.js";
import { PayPalError } from "./paypal.js";
import { demoAccess } from "./access.js";

const LIMITS = {
  itemName: 80,
  personName: 60,
  condition: 1200,
  minDepositCents: 100,
  maxDepositCents: 50000, // $500 demo cap
};

function badRequest(message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

function forbidden(message = "This action requires the correct role key") {
  const err = new Error(message);
  err.status = 403;
  err.code = "FORBIDDEN";
  return err;
}

function now() {
  return new Date().toISOString();
}

function hashKey(key) {
  return createHash("sha256").update(String(key)).digest("hex");
}

export function buildApp({ store, paypal, ai, config }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false, limit: "4kb" }));
  app.use(demoAccess({ ...config.demo, appBaseUrl: config.paypal.appBaseUrl }));
  app.use(express.json({ limit: "64kb" }));
  const integrationModes = () => ({ paypal: paypal.mode, ai: ai.mode });
  const canResetDemo = async () => store.mode !== "postgres" && paypal.mode === "simulated"
    && !(await store.listRentals()).some(rental => rental.paypal?.mode === "sandbox");
  const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

  // Stage the HTTP result until durable COMMIT succeeds. Database advisory
  // locks coordinate decisions across app processes; the Set handles local
  // duplicate clicks without opening an extra database connection.
  const activeMutations = new Set();
  function databaseMutation(handler, lockRental = false) {
    return async (req, res, next) => {
      const id = lockRental ? req.params.id : null;
      if (id && activeMutations.has(id)) {
        return res.status(409).json({ error: { code: "OPERATION_IN_PROGRESS", message: "Another operation is running for this rental. Wait, then refresh." } });
      }
      if (id) activeMutations.add(id);
      try {
        const operation = async () => {
          let status = 200, body, sent = false;
          const buffered = {
            status(value) { status = value; return buffered; },
            json(value) { body = value; sent = true; return buffered; },
          };
          await handler(req, buffered, error => { throw error; });
          if (!sent) throw new Error("Mutation completed without an HTTP result");
          return { status, body };
        };
        const result = id && store.withRentalLock
          ? await store.withRentalLock(id, operation)
          : store.transaction ? await store.transaction(operation) : await operation();
        res.status(result.status).json(result.body);
      } catch (error) { next(error); }
      finally { if (id) activeMutations.delete(id); }
    };
  }
  const rentalMutation = handler => databaseMutation(handler, true);

  const log = (rentalId, type, detail = {}) =>
    store.appendEvent({ id: randomUUID(), rentalId, at: now(), type, detail });

  // Role keys are generated per rental at creation and returned exactly
  // once; only their hashes are persisted. Payment-changing endpoints
  // require the owner key. This is demo-grade capability security — a real
  // deployment needs accounts/OAuth (see README limitations).
  function serializeRental(rental) {
    const { auth, ...rest } = rental;
    return rest;
  }

  function roleFromKey(rental, req) {
    const key = req.get("X-Rental-Key");
    if (!key || !rental.auth) return null;
    const hash = hashKey(key);
    if (hash === rental.auth.ownerKeyHash) return "owner";
    if (hash === rental.auth.renterKeyHash) return "renter";
    return null;
  }

  function requireRole(rental, req, roles) {
    const role = roleFromKey(rental, req);
    if (!role || !roles.includes(role)) {
      throw forbidden(`Requires ${roles.join(" or ")} key`);
    }
    return role;
  }

  // ---- meta ---------------------------------------------------------------

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, modes: integrationModes(), promptVersion: PROMPT_VERSION, storage: store.mode || "json" });
  });

  app.get("/api/config", asyncRoute(async (_req, res) => {
    // Client ID is a public identifier; the secret never leaves the server.
    res.json({
      currency: config.currency,
      modes: integrationModes(),
      paypalClientId: config.paypal.enabled ? config.paypal.clientId : null,
      maxReportChars: config.ai.maxReportChars,
      canResetDemo: await canResetDemo(),
      demoAccessEnabled: Boolean(config.demo?.password),
    });
  }));

  // ---- rentals ------------------------------------------------------------

  app.get("/api/rentals", asyncRoute(async (_req, res) => {
    const rentals = [...(await store.listRentals())].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(serializeRental);
    res.json({ rentals });
  }));

  app.get("/api/rentals/:id", asyncRoute(async (req, res) => {
    const rental = await store.findRental(req.params.id);
    if (!rental) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Rental not found" } });
    res.json({ rental: serializeRental(rental), events: await store.eventsFor(rental.id), role: roleFromKey(rental, req) });
  }));

  app.post("/api/rentals", databaseMutation(async (req, res, next) => {
    try {
      const { itemName, ownerName, renterName, checkoutCondition, deposit } = req.body || {};
      if (typeof itemName !== "string" || !itemName.trim() || itemName.length > LIMITS.itemName)
        throw badRequest("itemName is required (max 80 chars)");
      if (typeof ownerName !== "string" || !ownerName.trim() || ownerName.length > LIMITS.personName)
        throw badRequest("ownerName is required (max 60 chars)");
      if (typeof renterName !== "string" || !renterName.trim() || renterName.length > LIMITS.personName)
        throw badRequest("renterName is required (max 60 chars)");
      if (typeof checkoutCondition !== "string" || checkoutCondition.length > LIMITS.condition)
        throw badRequest("checkoutCondition must be text (max 1200 chars)");
      const depositCents = dollarsToCents(Number(deposit));
      if (depositCents === null || depositCents < LIMITS.minDepositCents || depositCents > LIMITS.maxDepositCents)
        throw badRequest(`deposit must be between ${centsToMoney(LIMITS.minDepositCents)} and ${centsToMoney(LIMITS.maxDepositCents)} ${config.currency}`);

      const id = randomUUID();
      const order = await paypal.createDepositOrder({
        amountCents: depositCents,
        currency: config.currency,
        description: `FairHold deposit: ${itemName.trim()}`,
        referenceId: id,
        idempotencyKey: `order-${id}`,
      });

      const ownerKey = randomBytes(24).toString("hex");
      const renterKey = randomBytes(24).toString("hex");

      const rental = await store.saveRental({
        id,
        itemName: itemName.trim(),
        ownerName: ownerName.trim(),
        renterName: renterName.trim(),
        checkoutCondition: checkoutCondition.trim(),
        depositCents,
        currency: config.currency,
        state: "awaiting_approval",
        auth: { ownerKeyHash: hashKey(ownerKey), renterKeyHash: hashKey(renterKey) },
        paypal: { mode: paypal.mode, orderId: order.orderId, approveLink: order.approveLink, authorizationId: null, captureId: null, expiresAt: null },
        report: null,
        assessment: null,
        assessmentError: null,
        pendingCapture: null,
        resolution: null,
        createdAt: now(),
        updatedAt: now(),
      });
      await log(id, "created", { itemName: rental.itemName, depositCents });
      await log(id, "order_created", { orderId: order.orderId, mode: paypal.mode });
      // Keys are returned exactly once and are never stored in plaintext.
      res.status(201).json({ rental: serializeRental(rental), keys: { ownerKey, renterKey } });
    } catch (err) {
      next(err);
    }
  }));

  // Called after the renter approves in the PayPal sheet (sandbox) or clicks
  // the labeled simulated approval button. Renter key required.
  app.post("/api/rentals/:id/authorize", rentalMutation(async (req, res, next) => {
    try {
      const rental = await mustFind(req.params.id);
      requireRole(rental, req, ["renter"]);
      if (rental.state === "hold_active") return res.json({ rental: serializeRental(rental) }); // safe retry
      assertTransition(rental.state, "hold_active");
      const result = await paypal.authorizeOrder(rental.paypal.orderId, {
        idempotencyKey: `auth-${rental.paypal.orderId}`,
      });
      rental.paypal.authorizationId = result.authorizationId;
      rental.paypal.expiresAt = result.expiresAt;
      rental.state = "hold_active";
      rental.updatedAt = now();
      await store.saveRental(rental);
      await log(rental.id, "authorized", { authorizationId: result.authorizationId, expiresAt: result.expiresAt });
      res.json({ rental: serializeRental(rental) });
    } catch (err) {
      next(err);
    }
  }));

  // Either party may file the return condition report.
  app.post("/api/rentals/:id/report", rentalMutation(async (req, res, next) => {
    try {
      const rental = await mustFind(req.params.id);
      const role = requireRole(rental, req, ["owner", "renter"]);
      assertTransition(rental.state, "review_pending");
      const { report } = req.body || {};
      if (typeof report !== "string" || !report.trim()) throw badRequest("report text is required");
      if (report.length > config.ai.maxReportChars)
        throw badRequest(`report is limited to ${config.ai.maxReportChars} characters`);

      rental.state = "review_pending";
      rental.report = { text: report.trim(), submittedAt: now(), submittedBy: role };
      rental.updatedAt = now();
      await store.saveRental(rental);
      await log(rental.id, "report_submitted", { chars: report.trim().length, by: role });

      const result = await ai.assessCondition({
        itemName: rental.itemName,
        checkoutCondition: rental.checkoutCondition,
        report: rental.report.text,
        maxCents: rental.depositCents,
      });

      assertTransition(rental.state, "under_review");
      rental.state = "under_review";
      if (result.ok) {
        rental.assessment = { ...result.assessment, aiMode: ai.mode };
        rental.assessmentError = null;
        await log(rental.id, "proposal_created", {
          totalCents: result.assessment.totalCents,
          items: result.assessment.items.length,
          evidenceAllVerified: result.assessment.items.every((i) => i.evidenceVerified === true),
          confidence: result.assessment.confidence,
          aiMode: ai.mode,
          promptVersion: result.assessment.promptVersion,
        });
      } else {
        rental.assessment = null;
        rental.assessmentError = result.reason;
        await log(rental.id, "proposal_failed", { reason: result.reason });
      }
      rental.updatedAt = now();
      await store.saveRental(rental);
      res.json({ rental: serializeRental(rental) });
    } catch (err) {
      next(err);
    }
  }));

  // Owner decision. Idempotent: the same Idempotency-Key (or a repeated
  // decision on a resolved rental) never captures twice. PayPal's capture
  // status is checked explicitly: only COMPLETED resolves the rental;
  // PENDING parks it in `attention` for reconciliation; DECLINED/FAILED are
  // surfaced as errors and the rental stays under review.
  app.post("/api/rentals/:id/resolve", rentalMutation(async (req, res, next) => {
    try {
      const rental = await mustFind(req.params.id);
      requireRole(rental, req, ["owner"]);
      const { action, amount } = req.body || {};
      if (!["capture", "release"].includes(action)) throw badRequest("action must be 'capture' or 'release'");

      const idemKey = req.get("Idempotency-Key") || null;
      if (idemKey) {
        const prior = await store.idempotencyGet("resolve", `${rental.id}:${idemKey}`);
        if (prior) return res.json({ rental: serializeRental(await store.findRental(rental.id)), replayed: true, resolution: prior });
      }
      if (isTerminal(rental.state)) {
        // Same decision repeated after success: return current state instead
        // of double-charging.
        return res.json({ rental: serializeRental(rental), replayed: true, resolution: rental.resolution });
      }
      if (rental.state !== "under_review" && !(rental.state === "hold_active" && action === "release")) {
        throw new TransitionError(rental.state, action === "capture" ? "resolved_captured" : "resolved_released");
      }
      if (!rental.paypal.authorizationId) throw badRequest("No active authorization to resolve", "NO_AUTHORIZATION");

      if (action === "release") {
        await paypal.voidAuthorization(rental.paypal.authorizationId, { idempotencyKey: `void-${rental.id}` });
        rental.state = "resolved_released";
        rental.resolution = { action: "release", amountCents: 0, decidedAt: now() };
        await log(rental.id, "released", { authorizationId: rental.paypal.authorizationId });
      } else {
        const amountCents = dollarsToCents(Number(amount));
        if (amountCents === null || amountCents <= 0) throw badRequest("capture amount must be greater than zero");
        if (amountCents > rental.depositCents)
          throw badRequest(`capture amount cannot exceed the authorized hold of ${centsToMoney(rental.depositCents)} ${rental.currency}`, "AMOUNT_EXCEEDS_HOLD");
        const capture = await paypal.captureAuthorization(rental.paypal.authorizationId, {
          amountCents,
          currency: rental.currency,
          note: `FairHold deposit resolution for ${rental.itemName}`,
          idempotencyKey: `capture-${rental.id}`,
        });

        if (capture.status === "COMPLETED") {
          await finalizeCapture(rental, capture, amountCents);
        } else if (capture.status === "PENDING") {
          // Not a failure, not a success: park for reconciliation. The owner
          // must not be shown a confirmed outcome yet.
          assertTransition(rental.state, "attention");
          rental.state = "attention";
          rental.pendingCapture = {
            captureId: capture.captureId,
            amountCents,
            status: "PENDING",
            statusDetails: capture.statusDetails || null,
            requestedAt: now(),
          };
          rental.updatedAt = now();
          await store.saveRental(rental);
          await log(rental.id, "capture_pending", { captureId: capture.captureId, amountCents, statusDetails: capture.statusDetails || null });
          return res.status(202).json({
            rental: serializeRental(rental),
            pending: true,
            message: "PayPal accepted the capture but has not completed it yet. Use 'Check capture status' to reconcile.",
          });
        } else {
          // DECLINED / FAILED / unexpected: no money moved; stay reviewable.
          await log(rental.id, "capture_not_completed", { status: capture.status, statusDetails: capture.statusDetails || null });
          return res.status(502).json({
            error: {
              code: "CAPTURE_NOT_COMPLETED",
              message: `PayPal did not complete the capture (status: ${capture.status}). No funds were captured; the hold remains active.`,
              details: capture.statusDetails || null,
            },
          });
        }
      }
      rental.updatedAt = now();
      await store.saveRental(rental);
      if (idemKey) await store.idempotencySet("resolve", `${rental.id}:${idemKey}`, rental.resolution);
      res.json({ rental: serializeRental(rental) });
    } catch (err) {
      next(err);
    }
  }));

  // Reconcile an ambiguous outcome with PayPal instead of trusting local
  // state: re-read the capture and the authorization from the source of truth.
  app.post("/api/rentals/:id/reconcile", rentalMutation(async (req, res, next) => {
    try {
      const rental = await mustFind(req.params.id);
      requireRole(rental, req, ["owner"]);

      if (rental.pendingCapture) {
        const capture = await paypal.getCapture(rental.pendingCapture.captureId);
        if (capture.status === "COMPLETED") {
          const amountCents = rental.pendingCapture.amountCents;
          rental.pendingCapture = null;
          await finalizeCapture(rental, { captureId: capture.id, status: "COMPLETED" }, amountCents);
          await log(rental.id, "capture_reconciled", { captureId: capture.id, outcome: "COMPLETED" });
        } else if (capture.status === "PENDING") {
          rental.pendingCapture.statusDetails = capture.statusDetails || rental.pendingCapture.statusDetails;
          rental.updatedAt = now();
          await store.saveRental(rental);
          return res.json({ rental: serializeRental(rental), stillPending: true });
        } else {
          const failedStatus = capture.status;
          rental.pendingCapture = null;
          assertTransition(rental.state, "under_review");
          rental.state = "under_review";
          rental.updatedAt = now();
          await store.saveRental(rental);
          await log(rental.id, "capture_reconciled", { outcome: failedStatus });
          return res.json({
            rental: serializeRental(rental),
            captureFailed: true,
            message: `PayPal reports the capture as ${failedStatus}. No funds were captured; the hold is still active and the rental is back under review.`,
          });
        }
      } else if (rental.state === "resolved_captured" && rental.paypal.authorizationId) {
        // Refresh the post-capture authorization truth for the receipt.
        const auth = await paypal.getAuthorization(rental.paypal.authorizationId);
        rental.resolution = { ...rental.resolution, authorizationStatus: auth.status };
        rental.updatedAt = now();
        await store.saveRental(rental);
      }
      res.json({ rental: serializeRental(rental) });
    } catch (err) {
      next(err);
    }
  }));

  async function finalizeCapture(rental, capture, amountCents) {
    // Ask PayPal what actually happened to the authorization instead of
    // inferring the remainder from subtraction.
    let authorizationStatus = null;
    try {
      const auth = await paypal.getAuthorization(rental.paypal.authorizationId);
      authorizationStatus = auth.status;
    } catch {
      authorizationStatus = null; // unknown — the UI must say so
    }
    assertTransition(rental.state, "resolved_captured");
    rental.state = "resolved_captured";
    rental.paypal.captureId = capture.captureId;
    rental.resolution = {
      action: "capture",
      amountCents,
      captureId: capture.captureId,
      status: "COMPLETED",
      finalCapture: true,
      authorizationStatus,
      decidedAt: now(),
    };
    rental.updatedAt = now();
    await store.saveRental(rental);
    await log(rental.id, "captured", { amountCents, captureId: capture.captureId, authorizationStatus });
  }

  app.post("/api/rentals/:id/cancel", rentalMutation(async (req, res, next) => {
    try {
      const rental = await mustFind(req.params.id);
      requireRole(rental, req, ["owner"]);
      if (rental.state === "cancelled") return res.json({ rental: serializeRental(rental) });
      if (!canTransition(rental.state, "cancelled")) throw new TransitionError(rental.state, "cancelled");
      if (rental.paypal.authorizationId) {
        await paypal.voidAuthorization(rental.paypal.authorizationId, { idempotencyKey: `void-${rental.id}` });
        await log(rental.id, "authorization_voided", { authorizationId: rental.paypal.authorizationId });
      }
      rental.state = "cancelled";
      rental.resolution = { action: "cancel", amountCents: 0, decidedAt: now() };
      rental.updatedAt = now();
      await store.saveRental(rental);
      await log(rental.id, "cancelled", {});
      res.json({ rental: serializeRental(rental) });
    } catch (err) {
      next(err);
    }
  }));

  // ---- demo reset -----------------------------------------------------------

  app.post("/api/demo/reset", databaseMutation(async (_req, res) => {
    if (!(await canResetDemo())) {
      return res.status(409).json({ error: { code: "RESET_DISABLED", message: "Reset is disabled for PayPal sandbox rentals. Resolve or cancel each hold individually." } });
    }
    await store.replaceAll({ rentals: [], events: [], idempotency: {} });
    res.json({ ok: true });
  }));

  async function mustFind(id) {
    const rental = await store.findRental(id);
    if (!rental) {
      const err = new Error("Rental not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    return rental;
  }

  // ---- static frontend (production build) -----------------------------------

  const dist = path.join(REPO_ROOT, "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // ---- errors ---------------------------------------------------------------

  app.use((err, _req, res, _next) => {
    if (err instanceof TransitionError) {
      return res.status(409).json({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof PayPalError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, debugId: err.debugId, details: err.details },
      });
    }
    const status = err.status || 500;
    res.status(status).json({ error: { code: err.code || "INTERNAL", message: err.message || "Unexpected error" } });
  });

  return app;
}
