/**
 * Client Supabase minimal (API REST PostgREST + RPC), sans dépendance npm.
 * La clé service role reste strictement côté serveur.
 */

import { config } from './env.mjs';

export class BackendError extends Error {
  constructor(message, { status = 502, code = 'supabase_error', details = null } = {}) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const supabaseConfigured = () => config().supabase.configured;

async function call(path, { method = 'GET', body, headers = {}, prefer } = {}) {
  const { supabase } = config();
  if (!supabase.configured) {
    throw new BackendError('Supabase non configuré.', { status: 503, code: 'not_configured' });
  }

  const response = await fetch(`${supabase.url}/rest/v1/${path}`, {
    method,
    // Une fonction Netlify est tuée au bout de 10 s : on échoue plus tôt avec
    // une erreur exploitable plutôt que de laisser la requête pendre.
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined,
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' ? data?.message || data?.hint || data?.details : data;
    throw new BackendError(message || `Supabase HTTP ${response.status}`, {
      status: response.status === 429 ? 429 : 502,
      code: response.status === 429 ? 'quota' : 'supabase_error',
      details: data,
    });
  }
  return data;
}

const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const db = {
  /** Événements à venir (ou tous, pour la déduplication). */
  async listEvents({ from, to, limit = 200 } = {}) {
    const params = {
      select: '*',
      order: 'starts_at.asc',
      limit: String(limit),
      status: 'neq.rejected',
    };
    // `from` borne la fin, pas le début : une exposition commencée il y a
    // dix jours reste visible tant qu’elle n’est pas terminée.
    if (from) params.ends_at = `gte.${from}`;
    if (to) params.starts_at = `lte.${to}`;
    return (await call(`events${query(params)}`)) || [];
  },

  /** Événements récents/passés nécessaires au dédoublonnage. */
  async listRecentEvents(days = 3) {
    const from = new Date(Date.now() - days * 86400000).toISOString();
    return (
      (await call(
        `events${query({ select: '*', starts_at: `gte.${from}`, order: 'starts_at.asc', limit: '400' })}`
      )) || []
    );
  },

  async upsertEvents(events = []) {
    if (!events.length) return [];
    return (
      (await call(`events${query({ on_conflict: 'dedupe_key' })}`, {
        method: 'POST',
        body: events,
        prefer: 'resolution=merge-duplicates,return=representation',
      })) || []
    );
  },

  async deleteEvents(ids = []) {
    if (!ids.length) return;
    // PostgREST accepte `in.(a,b,c)` pour supprimer un lot.
    await call(`events${query({ id: `in.(${ids.join(',')})` })}`, { method: 'DELETE' });
  },

  async deletePast(before) {
    await call(`events${query({ ends_at: `lt.${before}` })}`, { method: 'DELETE' });
  },

  async insertSubmission(submission) {
    const rows = await call('event_submissions', {
      method: 'POST',
      body: submission,
      prefer: 'return=representation',
    });
    return Array.isArray(rows) ? rows[0] : rows;
  },

  async listSubmissions({ status = 'pending', limit = 50 } = {}) {
    return (
      (await call(
        `event_submissions${query({ select: '*', status: `eq.${status}`, order: 'created_at.asc', limit: String(limit) })}`
      )) || []
    );
  },

  async updateSubmission(id, patch) {
    return call(`event_submissions${query({ id: `eq.${id}` })}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=representation',
    });
  },

  async insertReport(report) {
    const rows = await call('event_reports', {
      method: 'POST',
      body: report,
      prefer: 'resolution=ignore-duplicates,return=representation',
    });
    return Array.isArray(rows) ? rows[0] : rows;
  },

  async listReports({ limit = 100 } = {}) {
    return (
      (await call(`event_reports${query({ select: '*', order: 'created_at.desc', limit: String(limit) })}`)) || []
    );
  },

  /** Compteur atomique (fonction SQL `consume_rate_limit`). */
  async consumeRateLimit({ key, limit, windowSeconds }) {
    return call('rpc/consume_rate_limit', {
      method: 'POST',
      body: { p_key: key, p_limit: limit, p_window_seconds: windowSeconds },
    });
  },
};
