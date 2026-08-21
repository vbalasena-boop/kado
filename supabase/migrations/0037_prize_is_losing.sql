-- Drapeau explicite « lot perdant », indépendant du libellé.
--
-- Historiquement, gagné/perdu était déduit de la présence de « rien » dans le
-- libellé du lot — fragile : renommer la case perdante cassait silencieusement
-- la détection (jeu, plafond quotidien, validation en caisse, stats).
--
-- On ajoute une colonne booléenne explicite. Le backfill applique EXACTEMENT
-- l'heuristique actuelle → aucun changement de comportement sur l'existant.
-- Ensuite : le code renseigne is_losing à la création des lots (avant tout
-- renommage) et l'instantané à chaque tour. Le code reste tolérant si cette
-- migration n'est pas encore appliquée (repli sur le libellé).

-- ---- Lots (configuration) ----
alter table prizes
  add column if not exists is_losing boolean not null default false;

update prizes set is_losing = true
  where lower(label) like '%rien%';

-- ---- Tours joués (instantané) ----
-- Nullable : null = tour antérieur à la migration → le code retombe sur le
-- libellé. Les nouveaux tours écrivent la valeur explicitement.
alter table plays
  add column if not exists is_losing boolean;

update plays set is_losing = (lower(prize_label) like '%rien%')
  where prize_label is not null;
