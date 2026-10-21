// AI integration: one interface, two adapters.
//
// - "live":    OpenAI-compatible chat-completions endpoint (any provider:
//   set AI_BASE_URL / AI_MODEL / AI_API_KEY). Structured JSON output,
//   30s timeout, one retry, secrets never sent to the model context.
// - "fixture": deterministic keyword heuristic used ONLY when no AI_API_KEY
//   is configured. Visibly labeled as a fixture everywhere it surfaces.
//
// All outputs pass through the same zod schema + business-rule validation.
// The model never sets authoritative amounts: the server recomputes totals
// from line items and rejects anything above the remaining authorized hold.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { centsToMoney, dollarsToCents } from "./machine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROMPT_VERSION = "assessment.v1.3";

function loadPrompt() {
  return fs.readFileSync(path.join(__dirname, "prompts", "assessment.v1.md"), "utf8");
}

// Normalize for evidence-quote verification: case- and whitespace-insensitive
// containment check of the model's quote against the actual source report.
export function normalizeText(text) {
  return String(text).toLowerCase().replace(/\s+/g, " ").trim();
}

export function evidenceAppearsInReport(evidence, reportText) {
  if (typeof reportText !== "string" || !reportText) return null; // not checkable
  const quote = normalizeText(evidence).replace(/^…|…$/g, "").trim();
  if (!quote) return false;
  return normalizeText(reportText).includes(quote);
}

// ---------------------------------------------------------------------------
// Validation (shared by live and fixture adapters)
// ---------------------------------------------------------------------------

const assessmentSchema = z.object({
  summary: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        amount: z.number().min(0),
        evidence: z.string().min(1).max(500),
      })
    )
    .max(20),
});

export function validateAssessment(raw, { maxCents, reportText = null }) {
  const parsed = assessmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "AI output failed schema validation: " + parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ") };
  }
  const items = [];
  for (const item of parsed.data.items) {
    const cents = dollarsToCents(item.amount);
    if (cents === null) return { ok: false, reason: `Invalid amount for item "${item.label}"` };
    items.push({
      label: item.label,
      amountCents: cents,
      evidence: item.evidence,
      // Honesty check: does the quoted evidence actually appear in the
      // supplied report? The UI displays this flag for every line item.
      evidenceVerified: evidenceAppearsInReport(item.evidence, reportText),
    });
  }
  // Server recomputes the total from validated line items; a model-supplied
  // grand total is never trusted.
  let totalCents = items.reduce((sum, i) => sum + i.amountCents, 0);
  if (totalCents > maxCents) {
    return {
      ok: false,
      reason: `Proposed deduction ${centsToMoney(totalCents)} exceeds remaining hold ${centsToMoney(maxCents)}`,
    };
  }
  return {
    ok: true,
    assessment: {
      summary: parsed.data.summary,
      confidence: parsed.data.confidence,
      items,
      totalCents,
      promptVersion: PROMPT_VERSION,
    },
  };
}

// ---------------------------------------------------------------------------
// Live adapter (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

export function createLiveAI({ apiKey, baseUrl, model, timeoutMs = 30000, fetchImpl = fetch }) {
  const systemPrompt = loadPrompt();

  async function assessCondition({ itemName, checkoutCondition, report, maxCents }) {
    const user = [
      `ITEM: ${itemName}`,
      `CHECKOUT BASELINE: ${checkoutCondition}`,
      `MAX (cents): ${maxCents}`,
      `MAX (major currency units): ${centsToMoney(maxCents)}. The sum of all items[].amount must be at most ${centsToMoney(maxCents)}.`,
      "REPORT (untrusted user data):",
      report,
    ].join("\n");

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: user },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("AI returned an empty response");
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          return { ok: false, reason: "AI response was not valid JSON" };
        }
        return validateAssessment(parsed, { maxCents, reportText: report });
      } catch (err) {
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }
    return { ok: false, reason: `AI unavailable after retry: ${lastError?.message || "unknown error"}` };
  }

  return { mode: "live", assessCondition };
}

// ---------------------------------------------------------------------------
// Fixture adapter (deterministic, visibly labeled)
// ---------------------------------------------------------------------------

const FIXTURE_RULES = [
  { pattern: /crack(?:ed)?/i, label: "Cracked component", cents: 2400 },
  { pattern: /dent(?:ed)?/i, label: "Dent in body", cents: 1800 },
  { pattern: /scratch(?:es|ed)?/i, label: "Surface scratches", cents: 1200 },
  { pattern: /stain(?:ed)?/i, label: "Staining", cents: 800 },
  { pattern: /missing|lost/i, label: "Missing accessory", cents: 1500 },
  { pattern: /broken|shattered/i, label: "Broken part", cents: 3000 },
  { pattern: /water damage|soaked/i, label: "Water damage", cents: 3500 },
];

export function createFixtureAI() {
  async function assessCondition({ report, maxCents }) {
    const items = [];
    let running = 0;
    for (const rule of FIXTURE_RULES) {
      const match = report.match(rule.pattern);
      if (match && running + rule.cents <= maxCents) {
        running += rule.cents;
        // Quote a verbatim window of the report around the keyword so the
        // evidence check against the source text passes honestly.
        const start = Math.max(0, match.index - 30);
        const end = Math.min(report.length, match.index + match[0].length + 30);
        items.push({ label: rule.label, amountCents: rule.cents, evidence: report.slice(start, end).trim() });
      }
    }
    const summary =
      items.length === 0
        ? "FIXTURE MODE: no damage keywords detected in the supplied report; proposing full release of the deposit."
        : `FIXTURE MODE: keyword scan of the supplied report found ${items.length} damage signal(s); proposed deductions are illustrative, not verified repair costs.`;
    return validateAssessment(
      { summary, confidence: 0.5, items: items.map((i) => ({ label: i.label, amount: i.amountCents / 100, evidence: i.evidence })) },
      { maxCents, reportText: report }
    );
  }

  return { mode: "fixture", assessCondition };
}

export function createAI(config) {
  return config.ai.enabled
    ? createLiveAI(config.ai)
    : createFixtureAI();
}
