-- Données de démonstration — établissement "Café Lumière" (slug: cafe-lumiere)
-- À exécuter APRÈS 0001_init.sql, dans Supabase > SQL Editor.

insert into businesses (slug, name, status, subscription_status)
values ('cafe-lumiere', 'Café Lumière', 'active', 'trial')
on conflict (slug) do nothing;

-- Config de la roue — ambiance « café chaleureuse » (fond crème clair,
-- café/caramel, décor viennoiseries) pour une démo appétissante.
insert into wheel_configs
  (business_id, primary_color, accent_color, bg_color, decor_emojis,
   instagram_url, review_url)
select id, '#8a5a34', '#c98a4b', '#faf5ee', '☕🥐🍪🍰',
       'https://instagram.com', 'https://google.com'
from businesses where slug = 'cafe-lumiere'
on conflict (business_id) do nothing;

-- Cadeaux (probabilités = weight) — teintes chaudes assorties au thème café
insert into prizes (business_id, label, emoji, weight, color, position)
select b.id, v.label, v.emoji, v.weight, v.color, v.position
from businesses b,
(values
  ('Café offert',     '☕',  22, '#8a5a34', 0),
  ('-10 %',           '🏷️',  20, '#c98a4b', 1),
  ('Dessert offert',  '🍰', 12, '#d98a5a', 2),
  ('Rien cette fois', '🙈', 14, '#b8a58a', 3),
  ('Cocktail maison', '🍹', 8,  '#c0603f', 4),
  ('-20 %',           '💸', 10, '#9c6b3f', 5),
  ('Cadeau surprise', '🎁', 6,  '#e0a34a', 6),
  ('1 visite -15 %',  '⭐', 8,  '#7a4a2a', 7)
) as v(label, emoji, weight, color, position)
where b.slug = 'cafe-lumiere';
