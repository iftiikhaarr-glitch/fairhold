import { config, integrationModes } from "./config.js";
import { createStore } from "./store.js";
import { createPayPal } from "./paypal.js";
import { createAI } from "./ai.js";
import { buildApp } from "./app.js";

const store = createStore(config.dataFile);
const paypal = createPayPal(config);
const ai = createAI(config);
const app = buildApp({ store, paypal, ai, config });

const modes = integrationModes();
app.listen(config.port, () => {
  console.log(`FairHold API listening on http://localhost:${config.port}`);
  console.log(
    `Integrations: PayPal=${modes.paypal}${modes.paypal === "simulated" ? " (LABELED SIMULATION - set PAYPAL_CLIENT_ID/SECRET for real sandbox)" : ""}, ` +
      `AI=${modes.ai}${modes.ai === "fixture" ? " (LABELED FIXTURE - set AI_API_KEY for a live model)" : ""}`
  );
});
