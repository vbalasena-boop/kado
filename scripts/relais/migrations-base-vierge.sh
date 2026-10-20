#!/usr/bin/env bash
# Rejoue toutes les migrations sur un Postgres local vide (stubs auth/storage) et liste les erreurs.
# Prérequis : postgresql@16 (Homebrew). Usage : scripts/relais/migrations-base-vierge.sh
# Sortie 0 = aucune erreur SQL, 1 = au moins une migration en erreur.
set -euo pipefail
export PATH=/opt/homebrew/opt/postgresql@16/bin:$PATH LC_ALL=C LANG=C
rep=$(cd "$(git rev-parse --show-toplevel)/supabase/migrations" && pwd)
tmp=$(mktemp -d /tmp/kado-migrations.XXXXXX); port=${PGPORT_TEST:-55432}
trap 'pg_ctl -D "$tmp/pg" stop -m fast >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
initdb -D "$tmp/pg" -U postgres -A trust --encoding=UTF8 >/dev/null
pg_ctl -D "$tmp/pg" -o "-p $port -c listen_addresses= -c unix_socket_directories=$tmp" -l "$tmp/pg.log" -w start >/dev/null
P=(psql -X -v ON_ERROR_STOP=1 -h "$tmp" -p "$port" -U postgres -q)
"${P[@]}" -c "create role anon" -c "create role authenticated" -c "create role service_role" >/dev/null 2>&1
"${P[@]}" -c "create database vierge" >/dev/null
"${P[@]}" -d vierge >/dev/null 2>&1 <<'SQL'
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function auth.role() returns text language sql as $$ select 'anon' $$;
create schema storage; create table storage.buckets(id text primary key,name text,public bool, file_size_limit bigint, allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
create schema extensions; create extension if not exists pgcrypto; create extension if not exists pg_trgm;
SQL
echec=0
cd "$rep"
for f in *.sql; do
    if ! "${P[@]}" -d vierge -f "$f" >"$tmp/migration.log" 2>&1; then
        echo "$f : échec"
        cat "$tmp/migration.log"
        echec=1
    fi
done
[[ $echec = 0 ]] || exit 1
# Les tables tardives existent maintenant : vérifier les deux branches des gardes,
# puis un second rejeu sans aucune modification du schéma (base déjà à jour).
for passage in 1 2; do
    for f in 0011_growth.sql 0050_perf_indexes.sql; do
        "${P[@]}" -d vierge -f "$f" >"$tmp/rejeu.log" 2>&1 || {
            cat "$tmp/rejeu.log"
            exit 1
        }
    done
    pg_dump -h "$tmp" -p "$port" -U postgres -d vierge --schema-only |
        sed '/^\\restrict /d; /^\\unrestrict /d' >"$tmp/schema-$passage.sql"
done
diff -u "$tmp/schema-1.sql" "$tmp/schema-2.sql"
"${P[@]}" -d vierge <<'SQL'
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads'
      and column_name = 'unsubscribed_at'
  ) or to_regclass('public.prospect_messages_chan_status_step_idx') is null
    or to_regclass('public.prospect_events_type_created_idx') is null then
    raise exception 'Colonne leads ou index de prospection manquant';
  end if;
end;
$$;
SQL
echo "OK : toutes les migrations passent sur une base vide ; rejeu 0011/0050 idempotent"
