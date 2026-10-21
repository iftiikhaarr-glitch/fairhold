import { config, integrationModes } from "./config.js";
import { createStore } from "./store.js";
import { createPayPal } from "./paypal.js";
import { createAI } from "./ai.js";
import { buildApp } from "./app.js";

if (process.env.NODE_ENV === "production") {
  if (config.demo.password.length < 24) throw new Error("Production demo requires DEMO_ACCESS_PASSWORD with at least 24 characters.");
  if (!process.env.FAIRHOLD_APP_URL?.startsWith("https://")) throw new Error("Production demo requires FAIRHOLD_APP_URL set to its public HTTPS origin.");
  if (!process.env.FAIRHOLD_DATA_FILE) throw new Error("Production demo requires FAIRHOLD_DATA_FILE on durable storage.");
}

const store = createStore(config.dataFile);
const paypal = createPayPal(config);
const ai = createAI(config);
const app = buildApp({ store, paypal, ai, config });

const modes = integrationModes();
const server = app.listen(config.port, () => {
  console.log(`FairHold API listening on http://localhost:${server.address().port}`);
  console.log(
    `Integrations: PayPal=${modes.paypal}${modes.paypal === "simulated" ? " (LABELED SIMULATION - set PAYPAL_CLIENT_ID/SECRET for real sandbox)" : ""}, ` +
      `AI=${modes.ai}${modes.ai === "fixture" ? " (LABELED FIXTURE - set AI_API_KEY for a live model)" : ""}`
  );
});
