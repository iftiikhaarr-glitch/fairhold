// Resets the demo database to a clean state. Safe to run any time; all data
// is synthetic demo data.
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";

const fresh = { rentals: [], events: [], idempotency: {} };
fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
fs.writeFileSync(config.dataFile, JSON.stringify(fresh, null, 2));
console.log(`Demo data reset at ${config.dataFile}`);
