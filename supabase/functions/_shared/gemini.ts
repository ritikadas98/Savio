// Shared Vertex AI Gemini client for Supabase Edge Functions (Deno runtime).
//
// Reads three env vars:
//   GCP_PROJECT_ID — your GCP project ID (e.g. "savio-12345")
//   GCP_LOCATION   — Vertex region (e.g. "us-central1")
//   GCP_SA_JSON    — the full service-account JSON as a single-line string
//
// Mints a Google OAuth access token by signing a JWT with the service
// account's RS256 private key and exchanging it at oauth2.googleapis.com/token.
// The token is cached at module scope; Supabase keeps the Deno isolate warm
// between invocations, so only cold starts pay the mint cost (~300-500ms).
//
// Exposes one function: generateContent(model, payload) — returns the raw
// Vertex AI JSON response shape, which is structurally identical to the
// direct Gemini API response (candidates[0].content.parts[0].text etc).
//
// Vertex AI quirks vs. direct API:
//   - URL: {region}-aiplatform.googleapis.com/v1/projects/{p}/locations/{r}/publishers/google/models/{m}:generateContent
//   - Auth: Bearer token in header (no ?key= query param)
//   - Field rename: snake_case "system_instruction" → camelCase "systemInstruction"
//   - Everything else (generationConfig, thinkingConfig, contents) is identical.

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function readServiceAccount(): ServiceAccount {
  const raw = Deno.env.get('GCP_SA_JSON');
  if (!raw) throw new Error('GCP_SA_JSON env var is not set');
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`GCP_SA_JSON is not valid JSON: ${(e as Error).message}`);
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GCP_SA_JSON missing client_email or private_key');
  }
  return parsed;
}

// Base64url encode without padding (per JWT spec)
function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlEncodeString(s: string): string {
  return base64UrlEncode(new TextEncoder().encode(s));
}

// Parse a PEM-encoded PKCS#8 private key into a CryptoKey usable by SubtleCrypto.
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // The SA private_key has literal "\n" sequences when round-tripped through
  // JSON.stringify; JSON.parse turns them back into real newlines, so we
  // shouldn't need to do anything special here. Still, be defensive about
  // either form.
  const normalized = pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  const start = normalized.indexOf(header);
  const end = normalized.indexOf(footer);
  if (start === -1 || end === -1) {
    throw new Error('GCP_SA_JSON.private_key is not a PEM-encoded PKCS#8 key');
  }
  const b64 = normalized.slice(start + header.length, end).replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function mintAccessToken(): Promise<CachedToken> {
  const sa = readServiceAccount();
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64UrlEncodeString(JSON.stringify(header));
  const claimsB64 = base64UrlEncodeString(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await importPrivateKey(sa.private_key);
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuf));
  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`OAuth token exchange failed (${tokenRes.status}): ${body}`);
  }

  const json = await tokenRes.json() as { access_token: string; expires_in: number };
  // expires_in is seconds; cache until 60s before expiry to be safe
  const expiresAt = Date.now() + (json.expires_in - 60) * 1000;
  return { token: json.access_token, expiresAt };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  cachedToken = await mintAccessToken();
  return cachedToken.token;
}

// Vertex uses camelCase systemInstruction; the direct API used snake_case.
// Accept either input shape so callers can keep their existing payloads.
function normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  if ('system_instruction' in payload && !('systemInstruction' in payload)) {
    const { system_instruction, ...rest } = payload as { system_instruction: unknown } & Record<string, unknown>;
    return { ...rest, systemInstruction: system_instruction };
  }
  return payload;
}

export interface VertexResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: Record<string, unknown>;
  [k: string]: unknown;
}

/**
 * Call Vertex AI's generateContent on the configured project/region.
 * @param model  e.g. "gemini-2.5-flash"
 * @param payload Same shape as the direct Gemini API (system_instruction/systemInstruction, contents, generationConfig, etc.)
 */
export async function generateContent(
  model: string,
  payload: Record<string, unknown>,
): Promise<VertexResponse> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location  = Deno.env.get('GCP_LOCATION');
  if (!projectId) throw new Error('GCP_PROJECT_ID env var is not set');
  if (!location)  throw new Error('GCP_LOCATION env var is not set');

  const token = await getAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalizePayload(payload)),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vertex AI ${res.status}: ${body}`);
  }

  return await res.json() as VertexResponse;
}
