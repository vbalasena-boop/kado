-- Démo Kado — association « Le Café des Enfants » (La Soupape) — slug: cafe-des-enfants
-- Aux couleurs de l'association : magenta, vert tilleul, orange.
-- À exécuter dans Supabase > SQL Editor (après 0001_init.sql et 0027_decor.sql).
-- Page de jeu : https://kado-app.fr/cafe-des-enfants

insert into businesses (slug, name, status, subscription_status)
values ('cafe-des-enfants', 'Le Café des Enfants', 'active', 'trial')
on conflict (slug) do nothing;

-- Config de la roue — identité visuelle de l'asso (magenta + vert tilleul,
-- fond doux, décor enfant/atelier/café). Pas de légumes : ambiance ludique.
insert into wheel_configs
  (business_id, primary_color, accent_color, bg_color, decor_emojis,
   instagram_url, review_url)
select id, '#E6007E', '#8DC63F', '#fbf6ff', '🎨🖍️🎈🧁☕🍭',
       'https://instagram.com', 'https://google.com'
from businesses where slug = 'cafe-des-enfants'
on conflict (business_id) do update set
  primary_color = excluded.primary_color,
  accent_color  = excluded.accent_color,
  bg_color      = excluded.bg_color,
  decor_emojis  = excluded.decor_emojis;

-- Cadeaux (probabilités = weight) — tirés du vrai menu de l'asso.
-- On efface d'abord les anciens lots de démo pour rejouer le seed proprement.
delete from prizes p
using businesses b
where p.business_id = b.id and b.slug = 'cafe-des-enfants';

insert into prizes (business_id, label, emoji, weight, color, position)
select b.id, v.label, v.emoji, v.weight, v.color, v.position
from businesses b,
(values
  ('Un café offert',      '☕',  20, '#E6007E', 0),
  ('Un jus de fruit',     '🧃', 16, '#8DC63F', 1),
  ('Une sucette',         '🍭', 18, '#F39200', 2),
  ('Une compote',         '🍎', 12, '#A4C639', 3),
  ('Rien cette fois',     '🙈', 12, '#c9b8d8', 4),
  ('Un gâteau maison',    '🍰', 9,  '#ff5ba0', 5),
  ('Une limonade',        '🍋', 9,  '#f6b93b', 6),
  ('Un atelier découverte','🎨', 4,  '#7a3fd0', 7)
) as v(label, emoji, weight, color, position)
where b.slug = 'cafe-des-enfants';
