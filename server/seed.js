// Reset only local simulated data; do not discard real sandbox hold records.
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";

if (config.paypal.enabled || process.env.NODE_ENV === "production") {
  throw new Error("Reset is disabled with sandbox credentials or in production. Resolve or cancel holds individually.");
}
if (fs.existsSync(config.dataFile)) {
  const existing = JSON.parse(fs.readFileSync(config.dataFile, "utf8"));
  if (existing.rentals?.some(rental => rental.paypal?.mode === "sandbox")) {
    throw new Error("Reset refused: this store contains PayPal sandbox records.");
  }
}

const fresh = { rentals: [], events: [], idempotency: {} };
fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
fs.writeFileSync(config.dataFile, JSON.stringify(fresh, null, 2));
console.log(`Demo data reset at ${config.dataFile}`);
