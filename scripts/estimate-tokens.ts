#!/usr/bin/env npx tsx
/**
 * Estimates token count and cost for parsing an itinerary with Claude.
 *
 * Usage:
 *   npx tsx scripts/estimate-tokens.ts <file>
 *   npx tsx scripts/estimate-tokens.ts path/to/itinerary.txt
 *   npx tsx scripts/estimate-tokens.ts path/to/itinerary.pdf
 *   npx tsx scripts/estimate-tokens.ts path/to/itinerary.docx
 *   echo "Day 1: Fly to Rome..." | npx tsx scripts/estimate-tokens.ts
 */

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

// Mirror of the prompt template in lib/parseItinerary.ts — keep in sync.
const PARSE_PROMPT = `You are an expert travel itinerary parser. Extract structured data from the following itinerary document and return ONLY valid JSON in this exact format:

{
  "tripName": "string",
  "destination": "string (primary destination)",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD or null",
      "title": "string",
      "stops": [
        {
          "name": "string",
          "type": "hotel | restaurant | activity | transport | other",
          "time": "string or null",
          "address": "string or null",
          "notes": "string or null",
          "order": 1
        }
      ]
    }
  ]
}

Return only the JSON object. No explanations. No markdown.

ITINERARY:
{rawText}`;

// claude-sonnet-4-6 pricing (USD per million tokens)
const MODEL = "claude-sonnet-4-6";
const PRICE_INPUT_PER_M = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;
const MAX_OUTPUT_TOKENS = 4096;
const CONTEXT_WINDOW = 200_000;

// Template overhead = prompt without the {rawText} placeholder
const TEMPLATE_CHARS = PARSE_PROMPT.replace("{rawText}", "").length;

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse") as {
      PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
    };
    const buffer = fs.readFileSync(filePath);
    const data = await new PDFParse({ data: buffer }).getText();
    if (!data.text?.trim()) throw new Error("PDF has no extractable text (may be a scanned image).");
    return data.text;
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    if (!result.value?.trim()) throw new Error("Could not extract text from .docx file.");
    return result.value;
  }

  // Plain text (.txt, .md, etc.)
  return fs.readFileSync(filePath, "utf-8");
}

function heuristic(chars: number): number {
  // English prose: ~4 chars/token. Structured/JSON text skews slightly lower.
  return Math.ceil(chars / 4);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function bar(fraction: number, width = 30): string {
  const filled = Math.round(fraction * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

async function main() {
  let rawText: string;

  const filePath = process.argv[2];

  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: file not found — ${filePath}`);
      process.exit(1);
    }
    console.log(`Reading: ${filePath}`);
    rawText = await extractText(filePath);
  } else if (!process.stdin.isTTY) {
    rawText = fs.readFileSync("/dev/stdin", "utf-8");
  } else {
    console.error("Usage: npx tsx scripts/estimate-tokens.ts <file>");
    console.error("       Accepts .txt, .md, .pdf, .docx, or piped text.");
    process.exit(1);
  }

  const fullPrompt = PARSE_PROMPT.replace("{rawText}", rawText);

  // ── Heuristic estimates ──────────────────────────────────────────────────
  const h_template = heuristic(TEMPLATE_CHARS);
  const h_content  = heuristic(rawText.length);
  const h_total    = heuristic(fullPrompt.length);

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║        TripForge Token Estimator         ║");
  console.log("╚══════════════════════════════════════════╝\n");

  console.log("Input");
  console.log(`  Itinerary text:   ${fmt(rawText.length)} chars`);
  console.log(`  Full prompt:      ${fmt(fullPrompt.length)} chars`);
  console.log(`  (template overhead: ${fmt(TEMPLATE_CHARS)} chars)\n`);

  console.log("── Heuristic estimate (~4 chars/token) ───────");
  console.log(`  Prompt template:  ~${fmt(h_template)} tokens`);
  console.log(`  Itinerary text:   ~${fmt(h_content)} tokens`);
  console.log(`  Total input:      ~${fmt(h_total)} tokens`);
  console.log(`  Max output:        ${fmt(MAX_OUTPUT_TOKENS)} tokens`);

  const h_pct = (h_total / CONTEXT_WINDOW) * 100;
  console.log(`  Context window:   ${bar(h_total / CONTEXT_WINDOW)} ${h_pct.toFixed(1)}% of ${fmt(CONTEXT_WINDOW)}`);

  const h_cost = (h_total / 1_000_000) * PRICE_INPUT_PER_M +
                 (MAX_OUTPUT_TOKENS / 1_000_000) * PRICE_OUTPUT_PER_M;
  console.log(`  Est. cost:        $${h_cost.toFixed(4)}  (input $${((h_total / 1_000_000) * PRICE_INPUT_PER_M).toFixed(4)} + output $${((MAX_OUTPUT_TOKENS / 1_000_000) * PRICE_OUTPUT_PER_M).toFixed(4)})`);

  // ── Exact API count ──────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("\n(Set ANTHROPIC_API_KEY to get exact token counts via the API)");
    return;
  }

  console.log("\n── API count (exact) ─────────────────────────");
  try {
    const client = new Anthropic();
    const response = await client.messages.countTokens({
      model: MODEL,
      messages: [{ role: "user", content: fullPrompt }],
    });

    const apiTokens = response.input_tokens;
    const api_pct = (apiTokens / CONTEXT_WINDOW) * 100;
    const api_cost = (apiTokens / 1_000_000) * PRICE_INPUT_PER_M +
                     (MAX_OUTPUT_TOKENS / 1_000_000) * PRICE_OUTPUT_PER_M;

    console.log(`  Input tokens:     ${fmt(apiTokens)} tokens`);
    console.log(`  Max output:       ${fmt(MAX_OUTPUT_TOKENS)} tokens`);
    console.log(`  Context window:   ${bar(apiTokens / CONTEXT_WINDOW)} ${api_pct.toFixed(1)}% of ${fmt(CONTEXT_WINDOW)}`);
    console.log(`  Est. cost:        $${api_cost.toFixed(4)}  (input $${((apiTokens / 1_000_000) * PRICE_INPUT_PER_M).toFixed(4)} + output $${((MAX_OUTPUT_TOKENS / 1_000_000) * PRICE_OUTPUT_PER_M).toFixed(4)})`);
    console.log(`  Model:            ${MODEL}`);
  } catch (err) {
    console.log(`  API error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
