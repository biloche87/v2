/**
 * GET /api/health — diagnostic public, sans secret.
 * Permet à l’interface de savoir si le backend est branché et à l’équipe de
 * vérifier rapidement Supabase / Gemini après un déploiement.
 */

import { capabilities, config } from '../lib/env.mjs';
import { db, supabaseConfigured } from '../lib/supabase.mjs';
import { handle, json } from '../lib/http.mjs';

export const handler = (request) =>
  handle(async () => {
    const cfg = config();
    const caps = capabilities();
    let database = { configured: caps.supabase, reachable: false, upcoming: null };
    if (supabaseConfigured()) {
      try {
        const rows = await db.listEvents({ from: new Date().toISOString(), limit: 1 });
        database = { configured: true, reachable: true, upcoming: Array.isArray(rows) ? rows.length : 0 };
      } catch (error) {
        database = { configured: true, reachable: false, error: error.code || 'error' };
      }
    }
    return json(
      {
        ok: true,
        mode: caps.mode,
        services: {
          supabase: caps.supabase,
          gemini: caps.gemini,
          geminiChatPhrasing: cfg.gemini.chatPhrasing,
          admin: caps.admin,
        },
        database,
        model: caps.gemini ? cfg.gemini.model : null,
        limits: cfg.limits,
        time: new Date().toISOString(),
      },
      200,
      { 'Cache-Control': 'no-store' }
    );
  }, request, {});

export default handler;
