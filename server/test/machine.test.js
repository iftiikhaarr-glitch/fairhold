import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, assertTransition, centsToMoney, dollarsToCents, TransitionError } from "../machine.js";

test("happy-path transitions are allowed", () => {
  assert.equal(canTransition("awaiting_approval", "hold_active"), true);
  assert.equal(canTransition("hold_active", "review_pending"), true);
  assert.equal(canTransition("review_pending", "under_review"), true);
  assert.equal(canTransition("under_review", "resolved_captured"), true);
  assert.equal(canTransition("under_review", "resolved_released"), true);
  assert.equal(canTransition("hold_active", "resolved_released"), true);
});

test("illegal transitions are rejected", () => {
  assert.equal(canTransition("draft", "resolved_captured"), false);
  assert.equal(canTransition("resolved_captured", "under_review"), false);
  assert.equal(canTransition("cancelled", "hold_active"), false);
  assert.throws(() => assertTransition("awaiting_approval", "resolved_captured"), TransitionError);
});

test("money helpers use integer cents", () => {
  assert.equal(dollarsToCents(12.34), 1234);
  assert.equal(dollarsToCents(0.1 + 0.2), 30); // float-safe rounding
  assert.equal(dollarsToCents(-5), null);
  assert.equal(dollarsToCents(NaN), null);
  assert.equal(centsToMoney(1234), "12.34");
  assert.equal(centsToMoney(5), "0.05");
});
