// Central configuration. Secrets are read from the environment only and
// never leave the server. A minimal .env parser is included so the project
// has zero extra runtime dependencies for configuration.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

function loadDotEnv(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* .env is optional */
  }
}

loadDotEnv(path.join(REPO_ROOT, ".env"));

const env = process.env;

// Placeholder values from .env.example must not count as configuration.
function realValue(v) {
  return v && !v.startsWith("your-") ? v : "";
}

export const config = {
  port: Number(env.PORT || 8787),
  databaseUrl: realValue(env.DATABASE_URL) || "",
  storage: env.FAIRHOLD_STORAGE || (realValue(env.DATABASE_URL) ? "postgres" : "json"),
  demo: {
    username: env.DEMO_ACCESS_USER || "judge",
    password: realValue(env.DEMO_ACCESS_PASSWORD) || "",
  },
  currency: (env.FAIRHOLD_CURRENCY || "USD").toUpperCase(),

  paypal: {
    appBaseUrl: env.FAIRHOLD_APP_URL || "http://localhost:3000",
    clientId: realValue(env.PAYPAL_CLIENT_ID),
    clientSecret: realValue(env.PAYPAL_CLIENT_SECRET),
    // Sandbox only. Production endpoints are intentionally not supported.
    baseUrl: "https://api-m.sandbox.paypal.com",
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  ai: {
    apiKey: realValue(env.AI_API_KEY),
    baseUrl: (env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: env.AI_MODEL || "gpt-4o-mini",
    timeoutMs: Number(env.AI_TIMEOUT_MS || 30000),
    maxReportChars: Number(env.AI_MAX_REPORT_CHARS || 4000),
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  dataFile: env.FAIRHOLD_DATA_FILE || path.join(REPO_ROOT, "server", "data", "fairhold.json"),
};

// Integration mode summary shown in the UI and /api/health so that simulated
// operation is always visibly labeled.
export function integrationModes() {
  return {
    paypal: config.paypal.enabled ? "sandbox" : "simulated",
    ai: config.ai.enabled ? "live" : "fixture",
  };
}
