// Exercise the built production server without loading real integrations.
// Run after npm run build. Works on Windows and Linux; stops its own child.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fairhold-production-smoke-"));
const password = randomBytes(24).toString("hex");
const child = spawn(process.execPath, ["server/index.js"], {
  cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production", PORT: "0", DEMO_ACCESS_USER: "judge", DEMO_ACCESS_PASSWORD: password,
    FAIRHOLD_APP_URL: "https://demo.example.test", FAIRHOLD_DATA_FILE: path.join(dataDir, "data.json"),
    PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "", AI_API_KEY: "" },
});
let output = "", ended = false;
child.stdout.on("data", chunk => { output += chunk; });
child.stderr.on("data", chunk => { output += chunk; });
const exit = new Promise(resolve => child.on("close", () => { ended = true; resolve(); }));
try {
  let port;
  for (let i = 0; i < 100; i++) {
    port = /listening on http:\/\/localhost:(\d+)/.exec(output)?.[1];
    if (port) break;
    if (ended) throw new Error("Production server exited before startup");
    await setTimeout(100);
  }
  assert.ok(port, "production server must announce its bound port");
  const base = `http://127.0.0.1:${port}`;
  const headers = { Authorization: `Basic ${Buffer.from(`judge:${password}`).toString("base64")}` };
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.deepEqual(health.modes, { paypal: "simulated", ai: "fixture" });
  assert.equal((await fetch(`${base}/api/rentals`)).status, 401);
  const page = await fetch(base, { headers });
  assert.equal(page.status, 200);
  const html = await page.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"\s]*assets\/[^"\s]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith(".js")));
  assert.ok(assets.some(asset => asset.endsWith(".css")));
  for (const asset of assets) assert.equal((await fetch(new URL(asset, `${base}/`), { headers })).status, 200);
  const config = await (await fetch(`${base}/api/config`, { headers })).json();
  assert.equal(config.canResetDemo, true);
  console.log("PASS: production startup, public health, protected API, built HTML/JS/CSS, labeled fixture modes.");
  console.log("No PayPal or AI calls were made.");
} finally {
  if (!ended) child.kill();
  await exit;
  console.log("Validation server stopped.");
}
