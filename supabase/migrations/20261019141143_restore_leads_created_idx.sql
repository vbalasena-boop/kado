-- Restore an index missing from the live Kado database.
create index if not exists leads_biz_created_idx
  on leads (business_id, created_at);
