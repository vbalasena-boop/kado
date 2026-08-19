-- Page de stats du vendeur : accessible via une clé secrète (pas de compte
-- à créer). Le code du lien (?ref=) est semi-public, donc on utilise une
-- clé distincte, non devinable.
alter table affiliates
  add column if not exists stats_key uuid not null default gen_random_uuid();
create unique index if not exists affiliates_stats_key on affiliates (stats_key);
