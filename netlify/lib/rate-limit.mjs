/**
 * Limitation de débit par utilisateur.
 *
 * Priorité à la fonction SQL atomique `consume_rate_limit` (Supabase).
 * Si la base n’est pas configurée — ou si l’appel échoue — un compteur
 * mémoire prend le relais (utile pour les tests et `netlify dev`).
 * Une instance Netlify étant éphémère, le compteur mémoire n’est qu’un
 * filet de sécurité : la source de vérité reste Postgres en production.
 */

import { config } from './env.mjs';
import { db, supabaseConfigured } from './supabase.mjs';

const MEMORY = new Map();

function memoryConsume(key, limit, windowSeconds) {
  const now = Date.now();
  const current = MEMORY.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowSeconds * 1000 };
    MEMORY.set(key, next);
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, remaining: limit - current.count, retryAfter: 0 };
}

/**
 * @returns {Promise<{allowed:boolean, remaining:number, retryAfter:number, backend:'supabase'|'memory'}>}
 */
export async function consume({ key, limit, windowSeconds }) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return { allowed: true, remaining: Infinity, retryAfter: 0, backend: 'disabled' };
  }

  if (supabaseConfigured()) {
    try {
      const result = await db.consumeRateLimit({ key, limit, windowSeconds });
      const row = Array.isArray(result) ? result[0] : result;
      if (row) {
        return {
          allowed: Boolean(row.allowed),
          remaining: Number(row.remaining) || 0,
          retryAfter: Number(row.retry_after) || 0,
          backend: 'supabase',
        };
      }
    } catch (error) {
      console.warn('[rate-limit] RPC indisponible, repli mémoire :', error.message);
    }
  }

  return { ...memoryConsume(key, limit, windowSeconds), backend: 'memory' };
}

/** Limites configurées par type d’action. */
export function limitsFor(kind) {
  const cfg = config().limits;
  switch (kind) {
    case 'chat-hour':
      return { limit: cfg.chatPerHour, windowSeconds: 3600 };
    case 'chat-day':
      return { limit: cfg.chatPerDay, windowSeconds: 86400 };
    case 'import':
      return { limit: cfg.importPerHour, windowSeconds: 3600 };
    case 'submit':
      return { limit: cfg.submitPerDay, windowSeconds: 86400 };
    case 'report':
      return { limit: cfg.reportPerHour, windowSeconds: 3600 };
    default:
      return { limit: 30, windowSeconds: 3600 };
  }
}

export const __resetMemory = () => MEMORY.clear();
