/**
 * POST /api/import-event — pré-remplissage d’une fiche depuis une affiche.
 *
 * L’image (data URL), le lien et/ou le texte sont envoyés à Gemini en mode
 * vision. Rien n’est publié : la réponse est un brouillon que l’utilisateur
 * relit, puis envoie via /api/submit-event où l’admin valide.
 */

import { CATEGORIES, normalizeEvent, normalizeText } from '../lib/events-core.mjs';
import { generateJson, geminiConfigured } from '../lib/gemini.mjs';
import { consume, limitsFor } from '../lib/rate-limit.mjs';
import { clientKey, fail, handle, json, methodNotAllowed } from '../lib/http.mjs';

const DRAFT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    startsAt: { type: 'STRING', description: 'ISO 8601 avec +00:00, omis si absent de l’affiche.' },
    endsAt: { type: 'STRING', description: 'ISO 8601 avec +00:00, omis si absent.' },
    venue: { type: 'STRING' },
    neighborhood: { type: 'STRING' },
    lat: { type: 'NUMBER' },
    lng: { type: 'NUMBER' },
    price: { type: 'INTEGER', description: 'FCFA, 0 si gratuit, omis si inconnu.' },
    organizer: { type: 'STRING' },
    sourceUrl: { type: 'STRING' },
    category: { type: 'STRING', enum: CATEGORIES },
    reliability: { type: 'INTEGER', description: 'Confiance dans l’extraction, 0-100.' },
    missing: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Champs illisibles ou absents.' },
  },
  required: ['title', 'category', 'reliability'],
};

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 4_500_000;

function parseDataUrl(dataUrl = '') {
  const match = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl));
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_MIME.includes(mimeType)) return { error: 'unsupported_type' };
  const base64 = match[2].replace(/\s/g, '');
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return { error: 'too_large' };
  return { mimeType, base64, bytes };
}

const PROMPT = [
  'Analyse cette affiche d’événement à Bamako (Mali) et remplis la fiche.',
  'Règles strictes : recopie uniquement ce qui est lisible sur l’affiche, le lien ou le texte fourni. N’invente aucune date, aucun prix, aucun lieu.',
  'Si une information manque, laisse le champ vide et ajoute son nom dans « missing ».',
  'Les dates sont en ISO 8601 avec +00:00 (Bamako, UTC+0). Le prix est en FCFA (0 si l’entrée est gratuite).',
  'Le score de fiabilité dépend de la lisibilité : 85+ si tout est net, 60-84 si quelques champs manquent, moins de 60 si l’affiche est partielle.',
  `Catégories autorisées : ${CATEGORIES.join(', ')}.`,
].join('\n');

export const handler = (request) =>
  handle(async () => {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);

    let body = {};
    try {
      body = await request.json();
    } catch (error) {
      return fail(400, 'invalid_json', 'Corps JSON invalide.');
    }

    const text = String(body.text || '').slice(0, 4000).trim();
    const link = String(body.link || '').slice(0, 500).trim();
    const lang = body.lang === 'bm' ? 'bm' : 'fr';
    const image = body.imageDataUrl ? parseDataUrl(body.imageDataUrl) : null;

    if (body.imageDataUrl && !image) return fail(400, 'invalid_image', 'Image illisible ou format non pris en charge.');
    if (image?.error === 'unsupported_type') return fail(415, 'unsupported_type', 'Formats acceptés : JPEG, PNG, WebP, GIF.');
    if (image?.error === 'too_large') return fail(413, 'too_large', 'Image trop volumineuse (4,5 Mo maximum).');
    if (!image && !text && !link) return fail(400, 'empty', 'Ajoutez une photo, un lien ou le texte de l’affiche.');

    if (!geminiConfigured()) {
      return fail(503, 'not_configured', 'Extraction IA non configurée. Le formulaire manuel reste disponible.', {
        mode: 'demo',
      });
    }

    // Le quota n’est consommé que pour une demande réellement exploitable.
    const key = clientKey(request, body);
    const quota = await consume({ key: `import:${key}`, ...limitsFor('import') });
    if (!quota.allowed) {
      return json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: `Limite d’imports atteinte. Réessayez dans ${Math.ceil(quota.retryAfter / 60)} min.`,
            retryAfter: quota.retryAfter,
          },
        },
        429,
        { 'Retry-After': String(quota.retryAfter) }
      );
    }

    const parts = [{ text: PROMPT }];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    if (text) parts.push({ text: `Texte fourni :\n${text}` });
    if (link) parts.push({ text: `Lien fourni : ${link}` });

    let result;
    try {
      result = await generateJson({
        system:
          'Tu es un assistant d’extraction pour BamaHub. Tu respectes scrupuleusement ce qui est écrit, tu signales les champs manquants et tu ne complètes jamais une information par déduction.',
        parts,
        schema: DRAFT_SCHEMA,
        // Un lien seul n’est lisible qu’avec la recherche web ; une affiche
        // (image) n’en a pas besoin.
        grounding: Boolean(link && !image),
        temperature: 0.1,
        // Les fonctions synchrones Netlify sont coupées à 10 s par défaut :
        // on rend la main avant, avec un message exploitable.
        budgetMs: 9_000,
      });
    } catch (error) {
      if (error.code === 'quota') {
        return json(
          {
            ok: false,
            error: { code: 'quota', message: 'Quota IA momentanément épuisé. Réessayez plus tard.', retryAfter: error.retryAfter || 3600 },
          },
          429,
          { 'Retry-After': String(error.retryAfter || 3600) }
        );
      }
      console.error('[import-event]', error);
      return fail(502, 'gemini_error', 'L’analyse de l’affiche a échoué. Vous pouvez remplir la fiche à la main.');
    }

    const raw = result.json || {};
    const draft = normalizeEvent(
      {
        ...raw,
        price: raw.price ?? 0,
        sourceUrl: raw.sourceUrl || link,
        sourceKind: 'poster',
        status: 'pending',
        reliability: Math.max(30, Math.min(92, Number(raw.reliability) || 55)),
      },
      { now: new Date(0) }
    );

    if (!draft) {
      return json({
        ok: false,
        error: {
          code: 'unreadable',
          message: 'Affiche illisible : la date ou le titre n’a pas pu être extrait. Complétez la fiche manuellement.',
        },
        mode: 'live',
        remaining: quota.remaining,
      });
    }

    // Le texte d’origine et les champs manquants aident l’utilisateur à relire.
    if (text && !draft.description) draft.description = normalizeText(text).slice(0, 600);
    const missing = Array.isArray(raw.missing) ? raw.missing.map((item) => String(item).slice(0, 40)).slice(0, 8) : [];

    return json({
      ok: true,
      draft,
      confidence: draft.reliability,
      missing,
      model: result.model,
      notice:
        lang === 'bm'
          ? 'IA y’a fiche labɛnnen. I ka a lajɛ ka kelen-kelen ɲɛjira walisa ka a bɔ.'
          : 'Fiche pré-remplie par l’IA à partir de l’affiche. Vérifiez chaque champ avant de publier.',
      remaining: quota.remaining,
      mode: 'live',
    });
  }, request, {});

export default handler;
