#!/usr/bin/env bash
# Rejoue toutes les migrations sur un Postgres local vide (stubs auth/storage) et liste les erreurs.
# Prérequis : postgresql@16 (Homebrew). Usage : scripts/relais/migrations-base-vierge.sh
# Sortie 0 = aucune erreur SQL, 1 = au moins une migration en erreur.
set -uo pipefail
export PATH=/opt/homebrew/opt/postgresql@16/bin:$PATH LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
rep=$(cd "$(git rev-parse --show-toplevel)/supabase/migrations" && pwd)
tmp=$(mktemp -d); port=${PGPORT_TEST:-55432}
trap 'pg_ctl -D "$tmp/pg" stop -m fast >/dev/null 2>&1; rm -rf "$tmp"' EXIT
initdb -D "$tmp/pg" -U postgres -A trust >/dev/null
pg_ctl -D "$tmp/pg" -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=" -l "$tmp/pg.log" -w start >/dev/null
P="psql -h 127.0.0.1 -p $port -U postgres -q"
$P -c "create role anon" -c "create role authenticated" -c "create role service_role" >/dev/null 2>&1
$P -c "create database vierge" >/dev/null
$P -d vierge >/dev/null 2>&1 <<'SQL'
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function auth.role() returns text language sql as $$ select 'anon' $$;
create schema storage; create table storage.buckets(id text primary key,name text,public bool, file_size_limit bigint, allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
create schema extensions; create extension if not exists pgcrypto; create extension if not exists pg_trgm;
SQL
echec=0
cd "$rep"
for f in $(ls *.sql | LC_ALL=C sort); do
    e=$($P -d vierge -f "$f" 2>&1 | grep ERROR | head -1)
    [ -n "$e" ] && { echo "$f : $e"; echec=1; }
done
[ $echec = 0 ] && echo "OK : toutes les migrations passent sur une base vide"
exit $echec
