-- Suivi des e-mails automatiques (relance fin d'essai, récap hebdo).
alter table businesses
  add column if not exists trial_reminder_sent_at timestamptz,
  add column if not exists recap_sent_at timestamptz;
