#!/usr/bin/env node
/**
 * run-divergence-tests.mjs — Savio vs. vanilla Gemini, side by side.
 *
 * Implements PM_DECISIONS "Phase 3 Build C.23". Sends a fixed query set to
 * (a) Savio's chat-respond Edge Function and (b) a raw Vertex/Gemini endpoint
 * with no grounding and no Savio system prompt, then writes the outputs
 * side-by-side into docs/divergence-tests.md (between the RESULTS markers).
 *
 * Same model on both sides (Gemini 2.5 Flash) so the only variable is the
 * product layer: grounding, structure, scope filter, hallucination guard,
 * cumulative context.
 *
 *   node --env-file=.env.local scripts/run-divergence-tests.mjs
 *
 * NB: chat-respond reads conversation history from the `chat_messages` table
 * (the frontend writes each turn there before calling the function). To make
 * the cumulative-context sequence genuinely exercise that path, the script
 * inserts each turn into chat_messages itself, mirroring ChatPage.tsx. Single
 * queries clear history first so each is isolated.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_PATH = resolve(__dirname, "../docs/divergence-tests.md");

// Priya's canonical seed UUID (0006_seed_priya.sql) — chat_messages.user_id
// references profiles.id, which is hardcoded in the seed (NOT auth.users.id).
const PRIYA_PROFILE_ID = "00000000-0000-4000-a000-000000000001";

// Accept either the Vertex-style env names documented in the doc, OR the
// existing Savio .env.local names (GCP_SA_KEY_PATH, GCP_LOCATION,
// GEMINI_MODEL_ID). Both work.
const cfg = {
  supabaseUrl: req("VITE_SUPABASE_URL"),
  anonKey: req("VITE_SUPABASE_ANON_KEY"),
  priyaEmail: env("DEMO_PRIYA_EMAIL") || "priya@savio.demo",
  priyaPassword: req("DEMO_PRIYA_PASSWORD"),
  saRaw: req("GCP_SA_JSON", "GCP_SA_KEY_PATH"),
  region: env("VERTEX_REGION") || env("GCP_LOCATION") || "us-central1",
  model: env("VERTEX_MODEL") || env("GEMINI_MODEL_ID") || "gemini-2.5-flash",
};

function env(name) {
  const v = process.env[name];
  return v ? v.replace(/^"(.*)"$/, "$1") : undefined;
}

function req(...names) {
  for (const name of names) {
    const v = env(name);
    if (v) return v;
  }
  console.error(`Missing required env var: ${names.join(" or ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Query set (C.23): verdict-eligible + prose + a scope probe + a sequence.
// ---------------------------------------------------------------------------
const SINGLE_QUERIES = [
  { category: "Verdict-eligible", q: "Can I afford a ₹3,500 watch?" },
  { category: "Verdict-eligible", q: "Should I buy a ₹50,000 laptop?" },
  { category: "Verdict-eligible", q: "I want to book a ₹12,000 weekend trip to Goa — is that okay?" },
  { category: "Prose", q: "How am I doing this month?" },
  { category: "Prose", q: "Where is most of my money going?" },
  { category: "Prose", q: "I keep regretting my Myntra purchases. What should I do?" },
  { category: "Scope probe", q: "Which mutual fund should I invest in right now?" },
];

const SEQUENCE = {
  category: "Cumulative context (3-turn sequence)",
  turns: [
    "Can I afford a ₹5,000 watch?",
    "What about an ₹8k watch?",
    "On top of this ₹8k watch I also want a ₹1,00,000 Apple Watch.",
  ],
};

// ---------------------------------------------------------------------------
// Google service-account → OAuth (mirrors _shared/gemini.ts)
// ---------------------------------------------------------------------------
function loadServiceAccount(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  if (existsSync(trimmed)) return JSON.parse(readFileSync(trimmed, "utf8"));
  throw new Error("GCP_SA_JSON is neither inline JSON nor a readable file path.");
}

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mintGoogleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const sig = createSign("RSA-SHA256").update(signingInput).sign(sa.private_key, "base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${sig}`,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

// ---------------------------------------------------------------------------
// Vanilla Gemini — same model, no grounding, no Savio system prompt.
// ---------------------------------------------------------------------------
async function callVanillaGemini(history, token, projectId) {
  const url = `https://${cfg.region}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${cfg.region}/publishers/google/models/${cfg.model}:generateContent`;
  const body = {
    contents: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return `⟨vanilla call failed: ${res.status} ${await res.text()}⟩`;
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "⟨empty vanilla response⟩";
}

// ---------------------------------------------------------------------------
// Savio session — sign in as Priya, then helpers wrap auth.
// ---------------------------------------------------------------------------
async function signInAsPriya() {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: cfg.priyaEmail, password: cfg.priyaPassword }),
  });
  if (!res.ok) throw new Error(`Priya sign-in failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
  };
}

async function clearChatHistory(accessToken) {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/clear_chat_history`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: "{}",
  });
  if (!res.ok) {
    console.warn(`  clear_chat_history non-fatal: ${res.status} ${await res.text()}`);
  }
}

async function insertChatMessage(accessToken, role, content) {
  // Mirrors ChatPage.tsx's insert. Required so chat-respond's history read
  // picks up earlier turns in the sequence.
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/chat_messages`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: PRIYA_PROFILE_ID, role, content }),
  });
  if (!res.ok) {
    console.warn(`  chat_messages insert (${role}) non-fatal: ${res.status} ${await res.text()}`);
  }
}

/**
 * chat-respond contract (verified against supabase/functions/chat-respond/index.ts):
 *   Request:  { message }                       — history field is IGNORED
 *   Response: { response, ai_metadata: { structured, is_verdict, scope_filter_triggered, ... } }
 */
async function callSavio(message, accessToken) {
  const res = await fetch(`${cfg.supabaseUrl}/functions/v1/chat-respond`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    return { kind: "error", text: `⟨savio call failed: ${res.status} ${await res.text()}⟩`, structured: null, meta: null };
  }
  const data = await res.json();
  return normalizeSavioResponse(data);
}

function normalizeSavioResponse(data) {
  const meta = data?.ai_metadata || null;
  const structured = meta?.structured || null;
  const responseText = String(data?.response ?? "");
  let kind = "prose";
  if (structured) kind = "structured";
  else if (meta?.scope_filter_triggered) kind = "scope_deflection";

  if (structured) {
    const parts = [];
    parts.push(`[${structured.verdict_color}] ${structured.verdict_line}`);
    if (structured.body) parts.push(structured.body);
    if (structured.tradeoffs?.length) parts.push("Tradeoffs:\n- " + structured.tradeoffs.join("\n- "));
    if (structured.best_next_step) parts.push(`Best next step: ${structured.best_next_step}`);
    return { kind, text: parts.join("\n\n"), structured, meta };
  }
  return { kind, text: responseText, structured: null, meta };
}

// ---------------------------------------------------------------------------
// Cheap, factual signals (no editorializing).
// ---------------------------------------------------------------------------
function signalsLine(savio, vanillaText) {
  const s = [];
  s.push(`Savio response kind: \`${savio.kind}\``);
  if (savio.structured?.verdict_color) s.push(`Savio returned a verdict signal (\`${savio.structured.verdict_color}\`)`);
  if (savio.meta?.scope_filter_triggered) s.push(`Savio invoked scope refusal (family: ${savio.meta.scope_filter_triggered})`);
  if (savio.meta?.verified) s.push("Savio's hallucination guard verified the numbers");
  if (savio.meta?.fallback_used) s.push("Savio fell back to deterministic copy after guard");
  if (/₹\s?[\d,]+/.test(vanillaText)) s.push("vanilla stated a ₹ figure it has no source for");
  if (/mutual fund|invest in|stock|SIP|portfolio|allocat/i.test(vanillaText)) s.push("vanilla gave investment/instrument guidance");
  return s.length ? s.join("; ") : "none detected";
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------
function block({ category, q, savio, vanillaText }) {
  return [
    `### ${category} — "${q}"`,
    "",
    "**Savio**",
    "",
    "```",
    (savio.text?.trim() || "⟨empty⟩"),
    "```",
    "",
    "**Vanilla Gemini**",
    "",
    "```",
    (vanillaText?.trim() || "⟨empty⟩"),
    "```",
    "",
    `**Signals:** ${signalsLine(savio, vanillaText)}`,
    "",
    "---",
    "",
  ].join("\n");
}

function writeResults(markdown) {
  const start = "<!-- RESULTS:START -->";
  const end = "<!-- RESULTS:END -->";
  const stamp = `_Generated by \`scripts/run-divergence-tests.mjs\` on ${new Date().toISOString()}._`;
  const payload = `${start}\n\n${stamp}\n\n${markdown}\n${end}`;

  if (existsSync(DOC_PATH)) {
    const doc = readFileSync(DOC_PATH, "utf8");
    const re = new RegExp(`${start}[\\s\\S]*?${end}`);
    if (re.test(doc)) {
      writeFileSync(DOC_PATH, doc.replace(re, payload));
      console.log(`✔ Updated results in ${DOC_PATH}`);
      return;
    }
  }
  writeFileSync(DOC_PATH, `# Divergence Tests — Savio vs. a vanilla LLM\n\n${payload}\n`);
  console.log(`✔ Wrote ${DOC_PATH} (markers not found; wrote standalone).`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Authenticating…");
  const sa = loadServiceAccount(cfg.saRaw);
  const projectId = sa.project_id;
  const [googleToken, priyaToken] = await Promise.all([
    mintGoogleAccessToken(sa),
    signInAsPriya(),
  ]);

  const sections = [];

  console.log(`Running ${SINGLE_QUERIES.length} single queries…`);
  for (const item of SINGLE_QUERIES) {
    try {
      await clearChatHistory(priyaToken);
      await insertChatMessage(priyaToken, "user", item.q);
      const savio = await callSavio(item.q, priyaToken);
      const vanillaText = await callVanillaGemini([{ role: "user", text: item.q }], googleToken, projectId);
      sections.push(block({ ...item, savio, vanillaText }));
      console.log(`  ✓ ${item.q}`);
    } catch (e) {
      sections.push(block({ ...item, savio: { kind: "error", text: `⟨error: ${e.message}⟩`, structured: null, meta: null }, vanillaText: "⟨skipped⟩" }));
      console.log(`  ✗ ${item.q} — ${e.message}`);
    }
  }

  console.log("Running cumulative-context sequence…");
  sections.push(`## ${SEQUENCE.category}\n`);
  await clearChatHistory(priyaToken);
  const vanillaHistory = [];
  for (let i = 0; i < SEQUENCE.turns.length; i++) {
    const turn = SEQUENCE.turns[i];
    try {
      await insertChatMessage(priyaToken, "user", turn);
      const savio = await callSavio(turn, priyaToken);
      await insertChatMessage(priyaToken, "assistant", savio.text);

      vanillaHistory.push({ role: "user", text: turn });
      const vanillaText = await callVanillaGemini([...vanillaHistory], googleToken, projectId);
      vanillaHistory.push({ role: "model", text: vanillaText });

      sections.push(block({ category: `Turn ${i + 1}`, q: turn, savio, vanillaText }));
      console.log(`  ✓ Turn ${i + 1}: ${turn}`);
    } catch (e) {
      sections.push(block({ category: `Turn ${i + 1}`, q: turn, savio: { kind: "error", text: `⟨error: ${e.message}⟩`, structured: null, meta: null }, vanillaText: "⟨skipped⟩" }));
      console.log(`  ✗ Turn ${i + 1} — ${e.message}`);
    }
  }

  // Leave the demo state clean for the next reviewer.
  await clearChatHistory(priyaToken);

  writeResults(sections.join("\n"));
  console.log("Done.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
