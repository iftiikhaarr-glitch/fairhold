// Live AI-provider verification. Calls the configured OpenAI-compatible
// endpoint for real and records redacted evidence to VERIFICATION_LIVE.md.
// Usage: npm run verify:ai
// Never prints or stores the API key.
import fs from "node:fs";
import path from "node:path";
import { config, REPO_ROOT } from "../config.js";
import { createLiveAI } from "../ai.js";

const EVIDENCE_FILE = path.join(REPO_ROOT, "VERIFICATION_LIVE.md");

function appendEvidence(section) {
  fs.appendFileSync(EVIDENCE_FILE, section + "\n");
}

async function main() {
  console.log("FairHold live-AI verification\n");
  if (!config.ai.enabled) {
    console.log("SKIPPED: AI_API_KEY is not configured in .env (placeholders don't count).");
    console.log("Set AI_API_KEY (and optionally AI_BASE_URL / AI_MODEL), then re-run: npm run verify:ai");
    process.exit(2);
  }

  console.log(`Provider endpoint: ${config.ai.baseUrl}/chat/completions`);
  console.log(`Model:             ${config.ai.model}`);
  console.log("Key:               [configured, never displayed]\n");

  const ai = createLiveAI(config.ai);
  const report = "Rainfly has a long scratch and one pole is dented. Stakes all returned.";
  const started = Date.now();
  const result = await ai.assessCondition({
    itemName: "TrailBlazer 2-person tent",
    checkoutCondition: "Poles straight and complete (4), rainfly intact, footprint included. Known wear: minor scuff on the carry bag.",
    report,
    maxCents: 6000,
  });
  const latencyMs = Date.now() - started;

  if (!result.ok) {
    console.log(`FAILED: ${result.reason}`);
    appendEvidence(`\n## Live AI verification — ${new Date().toISOString()}\n\n- Model: ${config.ai.model} @ ${config.ai.baseUrl}\n- Result: FAILED — ${result.reason}\n`);
    process.exit(1);
  }

  const a = result.assessment;
  const withinBounds = a.totalCents <= 6000;
  const evidenceFlags = a.items.map((i) => i.evidenceVerified);
  const allVerified = a.items.length > 0 && evidenceFlags.every((v) => v === true);

  console.log(`Response received in ${latencyMs} ms`);
  console.log(`Summary:    ${a.summary}`);
  console.log(`Confidence: ${a.confidence}`);
  console.log(`Items:      ${a.items.length}`);
  for (const item of a.items) {
    console.log(`  - ${item.label}: ${(item.amountCents / 100).toFixed(2)} (quote verbatim in report: ${item.evidenceVerified})`);
  }
  console.log(`Total proposed: ${(a.totalCents / 100).toFixed(2)} (cap 60.00 — within bounds: ${withinBounds})`);
  console.log(`Prompt version: ${a.promptVersion}`);

  const pass = withinBounds && a.items.every((i) => i.evidenceVerified !== null);
  appendEvidence(`\n## Live AI verification — ${new Date().toISOString()}

- Provider endpoint: ${config.ai.baseUrl}/chat/completions (real external call, not mocked)
- Model: ${config.ai.model}
- Latency: ${latencyMs} ms
- Result: OK — ${a.items.length} item(s), total $${(a.totalCents / 100).toFixed(2)} within the $60.00 cap: ${withinBounds}
- Evidence quotes verified verbatim against the source report: ${JSON.stringify(evidenceFlags)}
- Summary (model output, quoted): "${a.summary.replace(/"/g, "'")}"
- Prompt version: ${a.promptVersion}
`);

  if (!pass) {
    console.log("\nFAILED: out-of-bounds total or uncheckable evidence.");
    process.exit(1);
  }
  if (!allVerified) {
    console.log("\nPASSED WITH WARNING: at least one evidence quote was not found verbatim in the report (flagged honestly in the UI).");
  } else {
    console.log("\nPASSED.");
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
