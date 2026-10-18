// FairHold deposit lifecycle state machine (pure functions, unit-tested).
//
// Payment truth: an order with intent=AUTHORIZE only places a hold. Money
// moves only on capture. "Resolved" states require PayPal confirmation,
// never a timer, animation, or model output.
//
//   draft ──create-order──> awaiting_approval ──authorize──> hold_active
//   awaiting_approval ──expire/cancel──> cancelled
//   hold_active ──submit-report──> review_pending ──ai-done──> under_review
//   review_pending ──ai-failed──> under_review (assessment=null, manual)
//   under_review ──capture(amount)──> resolved_captured
//   under_review ──release──> resolved_released
//   hold_active ──release──> resolved_released
//   hold_active ──cancel-before-return──> cancelled (void)
//   any payment/verification failure ──> attention (operator action needed)

export const STATES = Object.freeze([
  "draft",
  "awaiting_approval",
  "hold_active",
  "review_pending",
  "under_review",
  "resolved_captured",
  "resolved_released",
  "cancelled",
  "attention",
]);

export const TERMINAL_STATES = Object.freeze([
  "resolved_captured",
  "resolved_released",
  "cancelled",
]);

const TRANSITIONS = Object.freeze({
  draft: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["hold_active", "cancelled", "attention"],
  hold_active: ["review_pending", "under_review", "resolved_released", "cancelled", "attention"],
  review_pending: ["under_review", "attention"],
  under_review: ["resolved_captured", "resolved_released", "attention"],
  resolved_captured: [],
  resolved_released: [],
  cancelled: [],
  attention: ["under_review", "hold_active", "resolved_captured", "resolved_released", "cancelled"],
});

export class TransitionError extends Error {
  constructor(from, to) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.code = "INVALID_TRANSITION";
  }
}

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
  return to;
}

export function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

// ---- Money helpers (integer cents) --------------------------------------

export function dollarsToCents(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return cents >= 0 ? cents : null;
}

export function centsToMoney(cents) {
  return (cents / 100).toFixed(2);
}

export function clampCents(cents, min, max) {
  return Math.min(Math.max(cents, min), max);
}
