create table if not exists profiles (
  sub         text primary key,
  name        text,
  email       text,
  picture     text,
  import_json jsonb,
  imported_at timestamptz,
  updated_at  timestamptz not null default now()
);
