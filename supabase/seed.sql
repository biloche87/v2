-- ==========================================================================
-- Jeu de données de démonstration pour Supabase (facultatif).
-- Les dates sont relatives à `now()` : la démo reste crédible.
-- À lancer après schema.sql, puis à supprimer avant la mise en production :
--   delete from public.events where source_kind = 'seed';
-- ==========================================================================

insert into public.events
  (dedupe_key, title, description, starts_at, ends_at, venue, neighborhood, lat, lng,
   price_fcfa, organizer, source_url, category, reliability, status, source_kind, deal, tags)
values
  ('evt_seed_kora', 'Nuit du Kora',
   'Soirée de kora et de voix mandingues avec les maîtres de Bamako.',
   date_trunc('day', now()) + interval '20 hours',
   date_trunc('day', now()) + interval '23 hours',
   'Palais de la Culture Amadou Hampâté Bâ', 'Hamdallaye', 12.6421, -8.0117,
   5000, 'Association Kora Bamako', 'https://example.org/bamako/nuit-du-kora',
   'concert', 96, 'verified', 'seed', false, array['musique', 'kora']),

  ('evt_seed_marche', 'Marché de nuit de Badalabougou',
   'Artisans, brochettes et petits concerts acoustiques au bord du fleuve.',
   date_trunc('day', now()) + interval '18 hours',
   date_trunc('day', now()) + interval '23 hours',
   'Place du marché de Badalabougou', 'Badalabougou', 12.6261, -8.0062,
   0, 'Collectif Badalabougou Debout', 'https://example.org/bamako/marche-nuit',
   'marche', 92, 'verified', 'seed', false, array['gratuit', 'artisanat']),

  ('evt_seed_expo', 'Exposition « Bamako couleur terre »',
   'Trente photographes racontent la ville : rues, marchés et visages.',
   date_trunc('day', now()) + interval '10 hours',
   date_trunc('day', now()) + interval '20 days 18 hours',
   'Musée National du Mali', 'Quartier du fleuve', 12.6331, -7.9982,
   2000, 'Musée National du Mali', 'https://example.org/bamako/expo-couleur-terre',
   'expo', 94, 'verified', 'seed', false, array['photo']),

  ('evt_seed_kine', 'Kiné-Festival des enfants',
   'Spectacles, ateliers de dessin, contes et jeux pour les 3–12 ans.',
   date_trunc('day', now()) + interval '5 days 10 hours',
   date_trunc('day', now()) + interval '5 days 18 hours',
   'Place du Cinquantenaire', 'Quartier du fleuve', 12.6348, -8.0031,
   0, 'Kiné Collectif', 'https://example.org/bamako/kine-festival',
   'festival', 93, 'verified', 'seed', false, array['gratuit', 'enfants']),

  ('evt_seed_bonplan', '-30 % au restaurant Le Baobab',
   'Sur présentation du QR code BamaHub, -30 % sur le menu du jour jusqu’à 15 h.',
   date_trunc('day', now()) + interval '11 hours',
   date_trunc('day', now()) + interval '15 hours',
   'Le Baobab, Hamdallaye ACI 2000', 'Hamdallaye', 12.6394, -8.0135,
   1750, 'Le Baobab', 'https://example.org/bamako/bonplan-baobab',
   'bonplan', 95, 'verified', 'seed', true, array['restaurant', 'promo']),

  ('evt_seed_ia', 'Soirée afrobeat ACI',
   'DJ sets afrobeat, amapiano et coupé-décalé. Préventes en ligne.',
   date_trunc('day', now()) + interval '5 days 22 hours',
   date_trunc('day', now()) + interval '6 days 2 hours',
   'Rooftop ACI 2000', 'ACI 2000', 12.6398, -8.0221,
   5000, 'ACI Nights', 'https://example.org/bamako/afrobeat-aci',
   'soiree', 66, 'ai_suggested', 'seed', false, array['soirée'])
on conflict (dedupe_key) do nothing;
