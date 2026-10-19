/** Petits utilitaires HTTP partagés par les fonctions Netlify. */

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_HEADERS, ...headers },
  });
}

export function fail(status, code, message, extra = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}

/** Réponse 503 explicite : le client bascule en mode démo, sans erreur. */
export const notConfigured = (missing = 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY') =>
  fail(503, 'not_configured', `Backend non configuré (${missing}). Le site fonctionne en mode démo.`, {
    mode: 'demo',
  });

export function methodNotAllowed(allowed = ['GET']) {
  return json(
    { ok: false, error: 'method_not_allowed', message: `Méthode non autorisée. Utilisez ${allowed.join(', ')}.` },
    405,
    { Allow: allowed.join(', ') }
  );
}

export async function readJson(request, { maxBytes = 1_000_000 } = {}) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    const error = new Error('Content-Type application/json attendu.');
    error.status = 415;
    throw error;
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    const error = new Error('Charge utile trop volumineuse.');
    error.status = 413;
    throw error;
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    const invalid = new Error('JSON invalide.');
    invalid.status = 400;
    throw invalid;
  }
}

/** Identifiant stable côté serveur : IP + éventuel identifiant de session. */
export function clientKey(request, body = {}) {
  const headers = request.headers;
  const ip =
    headers.get('x-nf-client-connection-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const session = String(body.sessionId || headers.get('x-client-session') || '').slice(0, 80);
  return `${ip}:${session || 'anon'}`;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': 'same-origin',
  'Access-Control-Allow-Headers': 'Content-Type, X-Client-Session, X-Admin-Token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function preflight() {
  return new Response(null, { status: 204, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
}

/** Enveloppe une fonction : attrape les erreurs et renvoie un JSON propre. */
export async function handle(fn, request = { method: 'GET' }, context = {}) {
  if (request.method === 'OPTIONS') return preflight();
  try {
    return await fn(request, context);
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error(`[events] ${error?.stack || error}`);
    return fail(
      status,
      error?.code || (status === 500 ? 'internal_error' : 'request_error'),
      status === 500 ? 'Erreur interne. Réessayez plus tard.' : error.message || 'Requête invalide.'
    );
  }
}
