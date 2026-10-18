// Tiny JSON-file persistence with atomic writes. Money is stored as integer
// cents everywhere; only the PayPal boundary formats decimal strings.
import fs from "node:fs";
import path from "node:path";

export function createStore(file) {
  let state = { rentals: [], events: [], idempotency: {} };

  function load() {
    try {
      state = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      persist();
    }
  }

  function persist() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
  }

  load();

  return {
    get rentals() {
      return state.rentals;
    },
    get events() {
      return state.events;
    },
    findRental(id) {
      return state.rentals.find((r) => r.id === id) || null;
    },
    saveRental(rental) {
      const i = state.rentals.findIndex((r) => r.id === rental.id);
      if (i === -1) state.rentals.push(rental);
      else state.rentals[i] = rental;
      persist();
      return rental;
    },
    appendEvent(event) {
      state.events.push(event);
      persist();
      return event;
    },
    eventsFor(rentalId) {
      return state.events.filter((e) => e.rentalId === rentalId);
    },
    // Idempotency: remember the first result of a mutation keyed by
    // (scope, key) so client retries never double-capture.
    idempotencyGet(scope, key) {
      return state.idempotency[`${scope}:${key}`] || null;
    },
    idempotencySet(scope, key, value) {
      state.idempotency[`${scope}:${key}`] = value;
      persist();
    },
    replaceAll(next) {
      state = next;
      persist();
    },
  };
}
