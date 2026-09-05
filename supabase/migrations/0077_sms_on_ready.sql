-- SMS « votre commande est prête » (opt-in par établissement).
--
-- Défaut FALSE : aucun SMS (donc aucun coût) tant que le commerçant ne l'active
-- pas. Le SMS s'ajoute au push (gratuit) et à l'e-mail déjà envoyés quand une
-- commande passe en « prête » ; il n'a de sens que pour le click & collect et
-- ne part que si `SMSPARTNER_API_KEY` est configurée sur l'environnement.
alter table businesses
  add column if not exists sms_on_ready boolean not null default false;
