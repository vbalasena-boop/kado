-- Données de démonstration — établissement "Café Lumière" (slug: cafe-lumiere)
-- À exécuter APRÈS 0001_init.sql, dans Supabase > SQL Editor.

insert into businesses (slug, name, status, subscription_status)
values ('cafe-lumiere', 'Café Lumière', 'active', 'trial')
on conflict (slug) do nothing;

-- Config de la roue
insert into wheel_configs (business_id, primary_color, instagram_url, review_url)
select id, '#ffc24d', 'https://instagram.com', 'https://google.com'
from businesses where slug = 'cafe-lumiere'
on conflict (business_id) do nothing;

-- Cadeaux (probabilités = weight)
insert into prizes (business_id, label, emoji, weight, color, position)
select b.id, v.label, v.emoji, v.weight, v.color, v.position
from businesses b,
(values
  ('Café offert',     '☕',  22, '#ff5d73', 0),
  ('-10 %',           '🏷️',  20, '#8b6cff', 1),
  ('Dessert offert',  '🍰', 12, '#39d98a', 2),
  ('Rien cette fois', '🎯', 14, '#5a4a86', 3),
  ('Cocktail maison', '🍹', 8,  '#ffc24d', 4),
  ('-20 %',           '💸', 10, '#4fc3f7', 5),
  ('Cadeau surprise', '🎁', 6,  '#ff8a5c', 6),
  ('1 visite -15 %',  '⭐', 8,  '#ff5d73', 7)
) as v(label, emoji, weight, color, position)
where b.slug = 'cafe-lumiere';
