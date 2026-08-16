-- Envoi étalé des campagnes : la file des destinataires restants.
alter table campaigns
  add column if not exists pending_recipients text[];
