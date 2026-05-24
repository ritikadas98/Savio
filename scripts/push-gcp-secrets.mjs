// Pushes the GCP_* secrets to Supabase Edge Functions.
//
// Strategy: write a temp env file with the values single-quoted, then run
// `supabase secrets set --env-file <tmp>`. Single quotes in dotenv format
// preserve the value literally, so the JSON's \n escape sequences survive
// untouched (where they belong — JSON.parse will interpret them at runtime).
//
// Why not pass values as CLI args via child_process.spawn: on Windows we
// need shell:true to find npx (it's a .cmd file), and shell:true joins
// args into a single string interpreted by cmd.exe, which mangles
// embedded quotes and backslashes in the JSON. Temp file dodges all that.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const projectId  = process.env.GCP_PROJECT_ID;
const location   = process.env.GCP_LOCATION;
const keyPath    = process.env.GCP_SA_KEY_PATH || '.gcp-sa.json';
const accessTok  = process.env.SUPABASE_ACCESS_TOKEN;
const supaRef    = 'lstfbkcghnsoxyxpxnty';

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

if (!projectId) fail('GCP_PROJECT_ID is missing from .env.local');
if (!location)  fail('GCP_LOCATION is missing from .env.local');
if (!accessTok) fail('SUPABASE_ACCESS_TOKEN is missing from .env.local');
if (!fs.existsSync(keyPath)) fail(`Service account JSON not found at ${keyPath}`);

let sa;
try { sa = JSON.parse(fs.readFileSync(keyPath, 'utf8')); }
catch (e) { fail(`SA JSON did not parse: ${e.message}`); }
if (!sa.client_email || !sa.private_key || !sa.project_id) fail('SA JSON missing required fields');
if (sa.project_id !== projectId) fail(`Project ID mismatch: env=${projectId} json=${sa.project_id}`);

// Single-line JSON. The string CONTAINS "\n" as 2-char escape sequences,
// which JSON.parse on the server will interpret as newlines correctly.
const saSingleLine = JSON.stringify(sa);

// Write a temp env file. Use SINGLE QUOTES around the JSON value so dotenv
// parsing treats the value literally and doesn't try to interpret \n.
// JSON.stringify output contains no single quotes (', U+0027 isn't valid
// inside a JSON string without escaping, and the SA fields don't have any),
// so this is safe.
const tmpFile = path.join(os.tmpdir(), `savio-edge-secrets-${Date.now()}.env`);
const body =
  `GCP_PROJECT_ID=${projectId}\n` +
  `GCP_LOCATION=${location}\n` +
  `GCP_SA_JSON='${saSingleLine}'\n`;
fs.writeFileSync(tmpFile, body, { mode: 0o600 });

console.log(`Pushing 3 secrets to Supabase project ${supaRef}:`);
console.log(`  GCP_PROJECT_ID=${projectId}`);
console.log(`  GCP_LOCATION=${location}`);
console.log(`  GCP_SA_JSON=<${saSingleLine.length} chars, client_email=${sa.client_email.split('@')[0]}@…>`);

try {
  const setResult = spawnSync(
    'npx',
    ['supabase', 'secrets', 'set', '--env-file', tmpFile, '--project-ref', supaRef],
    {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessTok },
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
    },
  );
  if (setResult.status !== 0) fail(`supabase secrets set exited with ${setResult.status}`);
  console.log('✓ secrets set\n');
} finally {
  // Always clean up the temp file, even on error
  try { fs.unlinkSync(tmpFile); } catch {}
}

console.log('Unsetting old GEMINI_API_KEY (Vertex-only cutover):');
const unsetResult = spawnSync(
  'npx',
  ['supabase', 'secrets', 'unset', 'GEMINI_API_KEY', '--project-ref', supaRef],
  {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessTok },
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
  },
);
if (unsetResult.status !== 0) {
  console.warn(`! supabase secrets unset GEMINI_API_KEY returned ${unsetResult.status} (may already be unset)`);
} else {
  console.log('✓ GEMINI_API_KEY unset');
}
