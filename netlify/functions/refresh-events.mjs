/**
 * POST /api/refresh-events — tâche planifiée Netlify (06:00 et 15:00).
 *
 * 1. Supprime les événements terminés.
 * 2. Interroge Gemini avec Google Search grounding pour les événements et
 *    bons plans à venir à Bamako (repli automatique sans grounding).
 * 3. Structure les affiches et liens en attente (même sans grounding).
 * 4. Dédoublonne, plafonne les scores IA, écrit dans Supabase.
 *
 * Déclenchement manuel : POST avec l’en-tête `x-admin-token`.
 */

import { config } from '../lib/env.mjs';
import { buildRefreshPlan, normalizeEvent, CATEGORIES, bamakoToday } from '../lib/events-core.mjs';
import { db, supabaseConfigured } from '../lib/supabase.mjs';
import { generateJson, geminiConfigured } from '../lib/gemini.mjs';
import { handle, json, notConfigured } from '../lib/http.mjs';

const EVENT_PROPERTIES = {
  title: { type: 'STRING', description: 'Titre de l’événement, sans emoji ni majuscules criardes.' },
  description: { type: 'STRING', description: '2 à 3 phrases factuelles : programme, public, informations pratiques.' },
  startsAt: { type: 'STRING', description: 'Date et heure de début, ISO 8601 avec fuseau +00:00 (Bamako).' },
  endsAt: { type: 'STRING', description: 'Date et heure de fin, ISO 8601 +00:00.' },
  venue: { type: 'STRING', description: 'Lieu précis (salle, stade, place, établissement).' },
  neighborhood: {
    type: 'STRING',
    enum: ['Hamdallaye', 'ACI 2000', 'Badalabougou', 'Kalaban Coura', 'Magnambougou', 'Quartier du fleuve', 'Sotuba', 'Djicoroni', 'Niamakoro', 'Yirimadio', 'Sabalibougou', 'Lafiabougou', 'Banankabougou', 'Bamako'],
  },
  lat: { type: 'NUMBER', description: 'Latitude entre 12.4 et 12.8, omise si inconnue.' },
  lng: { type: 'NUMBER', description: 'Longitude entre -8.2 et -7.8, omise si inconnue.' },
  price: { type: 'INTEGER', description: 'Prix en FCFA (0 si gratuit).' },
  organizer: { type: 'STRING' },
  sourceUrl: { type: 'STRING', description: 'URL réelle où l’information a été trouvée.' },
  category: { type: 'STRING', enum: CATEGORIES },
  reliability: { type: 'INTEGER', description: '0-100 : 90+ si source officielle ou deux sources concordantes, 70-89 si une source crédible, <70 si incertain.' },
  deal: { type: 'BOOLEAN', description: 'Vrai pour une promotion ou un bon plan.' },
};

const EVENTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    events: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: EVENT_PROPERTIES,
        required: ['title', 'startsAt', 'endsAt', 'venue', 'neighborhood', 'price', 'category', 'sourceUrl', 'reliability'],
      },
    },
  },
  required: ['events'],
};

const DRAFTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    drafts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          submissionId: { type: 'STRING' },
          ...EVENT_PROPERTIES,
        },
        required: ['submissionId', 'title', 'startsAt', 'endsAt', 'venue', 'neighborhood', 'price', 'category'],
      },
    },
  },
  required: ['drafts'],
};

const isoDay = (offset = 0) => {
  const { y, m, d } = bamakoToday(new Date());
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};

function discoveryPrompt() {
  return [
    `Aujourd’hui : ${isoDay(0)} (Bamako, Mali, UTC+0).`,
    `Recherche sur le web les événements publics, concerts, expositions, spectacles, compétitions sportives, marchés, conférences et bons plans confirmés à Bamako entre ${isoDay(0)} et ${isoDay(35)}.`,
    'Utilise Google Search pour vérifier les dates, les lieux, les prix et les organisateurs. Croise deux sources quand c’est possible.',
    'Exclus les événements passés, les rumeurs non datées et les annonces commerciales sans date précise.',
    'Ne fabrique jamais une URL : sourceUrl doit être une page réellement consultée. Si tu n’as pas de source fiable pour un événement, ne le retourne pas.',
    'Retourne au maximum 15 événements, sans doublon (même événement = même jour et même lieu).',
    'Les prix sont en FCFA (entier, 0 si gratuit). Les dates sont en ISO 8601 avec +00:00.',
    `Catégories autorisées : ${CATEGORIES.join(', ')}.`,
    'Le score de fiabilité doit refléter la qualité des sources, pas ton enthousiasme.',
  ].join('\n');
}

function submissionsPrompt(submissions) {
  const payload = submissions.map((submission) => ({
    submissionId: submission.id,
    texte: String(submission.payload?.text || submission.payload?.description || '').slice(0, 1200),
    lien: String(submission.payload?.link || submission.payload?.sourceUrl || '').slice(0, 400),
    image: submission.payload?.imageUrl ? 'affiche fournie (non relue ici)' : 'aucune',
    soumisLe: submission.created_at,
  }));
  return [
    `Aujourd’hui : ${isoDay(0)} (Bamako, UTC+0).`,
    'Structure les affiches et liens soumis par les organisateurs. Extrais uniquement ce qui est écrit ; mets des valeurs vides ou omets les champs absents. Ne complète jamais une date ou un prix inventé.',
    'Chaque sortie doit reprendre le submissionId fourni.',
    `Catégories autorisées : ${CATEGORIES.join(', ')}.`,
    'Réponds uniquement avec les objets demandés.',
    JSON.stringify(payload),
  ].join('\n');
}

async function discoverEvents() {
  const result = await generateJson({
    system:
      'Tu es l’agent de veille de BamaHub, annuaire local de Bamako. Tu ne publies que des événements vérifiables, sourcés et à venir. Le doute se traduit par un score de fiabilité bas ou par l’absence de l’événement.',
    parts: [{ text: discoveryPrompt() }],
    schema: EVENTS_SCHEMA,
    grounding: true,
    temperature: 0.2,
    budgetMs: 14_000,
  });
  const list = Array.isArray(result.json?.events) ? result.json.events : [];
  return { list, grounding: Boolean(result.grounding), model: result.model };
}

async function structureSubmissions(submissions) {
  if (!submissions.length) return { drafts: [], model: null };
  const result = await generateJson({
    system:
      'Tu structures des affiches d’événements pour BamaHub (Bamako). Tu ne complètes jamais une information absente. Les dates sont en ISO 8601 +00:00.',
    parts: [{ text: submissionsPrompt(submissions) }],
    schema: DRAFTS_SCHEMA,
    grounding: false,
    temperature: 0.1,
    budgetMs: 6_000,
  });
  const drafts = Array.isArray(result.json?.drafts) ? result.json.drafts : [];
  return { drafts, model: result.model };
}

export const handler = (request, context = {}) =>
  handle(async () => {
    const cfg = config();

    // Netlify transmet `{ next_run }` dans le corps des invocations planifiées.
    let isScheduled = Boolean(context?.next_run) || request.headers.get('x-nf-event') === 'schedule';
    if (!isScheduled && request.method === 'POST') {
      try {
        const payload = await request.clone().json();
        isScheduled = Boolean(payload?.next_run);
      } catch (error) {
        /* corps vide ou non JSON : invocation manuelle */
      }
    }
    const token = request.headers.get('x-admin-token') || '';
    const authorized = token && cfg.adminToken && token === cfg.adminToken;
    if (!isScheduled && !authorized) {
      return json({ ok: false, error: 'unauthorized', message: 'Jeton administrateur requis.' }, 401);
    }

    if (!supabaseConfigured()) return notConfigured();

    const startedAt = new Date();
    const now = new Date();
    const summary = {
      ok: true,
      startedAt: startedAt.toISOString(),
      mode: 'live',
      gemini: geminiConfigured(),
      grounding: false,
      purged: false,
      discovered: 0,
      structured: 0,
      inserted: 0,
      duplicates: 0,
      submissionsUpdated: 0,
      errors: [],
      model: null,
    };

    // 1. Purge des événements terminés (6 h de tolérance pour les fuseaux).
    try {
      const cutoff = new Date(now.getTime() - 6 * 3600 * 1000).toISOString();
      await db.deletePast(cutoff);
      summary.purged = true;
      summary.purgedBefore = cutoff;
    } catch (error) {
      summary.errors.push(`purge: ${error.message}`);
    }

    // 2. Base existante (utile au dédoublonnage).
    let existing = [];
    try {
      existing = await db.listRecentEvents(3);
    } catch (error) {
      summary.errors.push(`lecture: ${error.message}`);
      return json({ ...summary, ok: false, message: 'Lecture Supabase impossible.' }, 502);
    }

    const candidates = [];

    // 3. Veille Gemini + Google Search.
    if (cfg.gemini.configured) {
      try {
        const discovery = await discoverEvents();
        summary.model = discovery.model;
        summary.grounding = discovery.grounding;
        summary.discovered = discovery.list.length;
        discovery.list.forEach((raw) => {
          const event = normalizeEvent(
            {
              ...raw,
              status: 'ai_suggested',
              sourceKind: 'ai',
              // Une découverte IA n’est jamais « vérifiée » d’office.
              reliability: Math.min(88, Number(raw.reliability) || 60),
            },
            { now, requireFuture: true }
          );
          if (event && event.source_url) candidates.push(event);
        });
      } catch (error) {
        summary.errors.push(`veille: ${error.message}`);
        if (error.code === 'quota') summary.quota = { retryAfter: error.retryAfter };
      }
    } else {
      summary.errors.push('veille: GEMINI_API_KEY absente');
    }

    // 4. Affiches et liens en attente.
    let pending = [];
    try {
      pending = await db.listSubmissions({ status: 'pending', limit: 8 });
    } catch (error) {
      summary.errors.push(`soumissions: ${error.message}`);
    }

    if (pending.length && cfg.gemini.configured && Date.now() - startedAt.getTime() < 18_000) {
      try {
        const { drafts, model } = await structureSubmissions(pending);
        summary.model = summary.model || model;
        const byId = new Map(pending.map((submission) => [submission.id, submission]));
        for (const draft of drafts) {
          const source = byId.get(draft.submissionId);
          if (!source) continue;
          const event = normalizeEvent(
            {
              ...draft,
              venue: draft.venue || source.payload?.venue,
              neighborhood: draft.neighborhood || source.payload?.neighborhood,
              organizer: draft.organizer || source.payload?.organizer,
              contact: source.payload?.contact,
              sourceKind: source.source_kind === 'poster' ? 'poster' : 'organizer',
              status: 'pending',
              reliability: Math.min(80, Number(draft.reliability) || 60),
            },
            { now, requireFuture: true }
          );
          if (!event) {
            summary.errors.push(`soumission ${draft.submissionId}: date ou titre inexploitable`);
            continue;
          }
          candidates.push(event);
          summary.structured += 1;
          try {
            await db.updateSubmission(source.id, {
              status: 'structured',
              draft: event,
              ai_model: model,
              structured_at: new Date().toISOString(),
            });
            summary.submissionsUpdated += 1;
          } catch (error) {
            summary.errors.push(`maj soumission ${source.id}: ${error.message}`);
          }
        }
      } catch (error) {
        summary.errors.push(`structuration: ${error.message}`);
      }
    }

    // 5. Dédoublonnage + écriture.
    const plan = buildRefreshPlan(candidates, existing, now);
    summary.duplicates = plan.duplicates;
    if (plan.writes.length) {
      try {
        const rows = await db.upsertEvents(plan.writes);
        summary.inserted = Array.isArray(rows) ? rows.length : plan.writes.length;
      } catch (error) {
        summary.ok = false;
        summary.errors.push(`écriture: ${error.message}`);
      }
    }

    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt.getTime();
    console.log('[refresh-events]', JSON.stringify({ ...summary, errors: summary.errors.slice(0, 5) }));
    return json(summary);
  }, request, context);

export default handler;
