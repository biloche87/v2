/**
 * Lecture centralisée des variables d’environnement.
 * Aucune clé n’est jamais exposée au navigateur : seules les fonctions
 * Netlify (côté serveur) lisent ces valeurs.
 */

export const env = (name, fallback = '') => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
};

export const intEnv = (name, fallback) => {
  const value = Number(env(name, ''));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function config() {
  const supabaseUrl = env('SUPABASE_URL').replace(/\/+$/, '');
  const supabaseKey = env('SUPABASE_SERVICE_ROLE_KEY');
  return {
    supabase: {
      url: supabaseUrl,
      key: supabaseKey,
      configured: Boolean(supabaseUrl && supabaseKey),
    },
    gemini: {
      key: env('GEMINI_API_KEY'),
      model: env('GEMINI_MODEL', 'gemini-2.5-flash'),
      fallbackModels: env('GEMINI_FALLBACK_MODELS', 'gemini-2.0-flash,gemini-1.5-flash')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean),
      configured: Boolean(env('GEMINI_API_KEY')),
      chatPhrasing: env('GEMINI_CHAT', '0') === '1',
      timeoutMs: intEnv('GEMINI_TIMEOUT_MS', 25_000),
    },
    adminToken: env('ADMIN_TOKEN'),
    siteUrl: env('SITE_URL', 'https://bamahub.ml').replace(/\/+$/, ''),
    limits: {
      chatPerHour: intEnv('CHAT_LIMIT_PER_HOUR', 30),
      chatPerDay: intEnv('CHAT_LIMIT_PER_DAY', 150),
      importPerHour: intEnv('IMPORT_LIMIT_PER_HOUR', 6),
      submitPerDay: intEnv('SUBMIT_LIMIT_PER_DAY', 5),
      reportPerHour: intEnv('REPORT_LIMIT_PER_HOUR', 20),
    },
  };
}

/** Résumé public (sans secret) pour les diagnostics et le mode démo. */
export function capabilities() {
  const cfg = config();
  return {
    supabase: cfg.supabase.configured,
    gemini: cfg.gemini.configured,
    admin: Boolean(cfg.adminToken),
    mode: cfg.supabase.configured ? 'live' : 'demo',
  };
}
