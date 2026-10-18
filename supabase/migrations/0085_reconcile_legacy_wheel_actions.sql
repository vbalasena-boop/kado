-- Les anciens réglages Instagram doivent rester respectés après le passage à
-- trigger_actions comme source de vérité du jeu.
-- Les autres actions (fidélité, opt-in) sont conservées telles quelles.
update wheel_configs
set trigger_actions = coalesce(
  (
    select jsonb_agg(action)
    from jsonb_array_elements(trigger_actions) as action
    where action #>> '{}' <> 'instagram'
  ),
  '[]'::jsonb
)
where instagram_enabled = false
  and jsonb_typeof(trigger_actions) = 'array'
  and trigger_actions @> '["instagram"]'::jsonb;
