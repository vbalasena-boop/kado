-- Kado — campagnes : choix du canal (e-mail / push / les deux)
-- et compteur de notifications push envoyées.
-- À exécuter dans Supabase > SQL Editor.

alter table campaigns
  add column if not exists channel text not null default 'email',
  add column if not exists pushed_count int not null default 0;
