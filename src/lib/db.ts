import { Pool } from "pg";
import type { ImportResult } from "./types";

// Vercel Postgres / Neon integrations inject the connstring under different
// names depending on vintage; DATABASE_URL is what we set by hand locally.
const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;
export const dbEnabled = Boolean(url);

let pool: Pool | null = null;
let ready: Promise<unknown> | null = null;

function getPool(): Pool {
  if (!pool) {
    const ssl =
      /[?&]sslmode=require/.test(url!) ||
      /\.neon\.tech/.test(url!) ||
      process.env.NODE_ENV === "production";
    pool = new Pool({
      connectionString: url,
      max: 3,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

function ensureSchema() {
  if (!ready) {
    ready = getPool().query(`
      create table if not exists profiles (
        sub         text primary key,
        name        text,
        email       text,
        picture     text,
        import_json jsonb,
        imported_at timestamptz,
        updated_at  timestamptz not null default now()
      )
    `);
  }
  return ready;
}

export type ProfileRow = {
  sub: string;
  name: string | null;
  email: string | null;
  picture: string | null;
  import_json: ImportResult | null;
  imported_at: string | null;
  updated_at: string;
};

export async function getProfile(sub: string): Promise<ProfileRow | null> {
  if (!dbEnabled) return null;
  await ensureSchema();
  const { rows } = await getPool().query<ProfileRow>(
    "select * from profiles where sub = $1",
    [sub],
  );
  return rows[0] ?? null;
}

export async function upsertLogin(p: {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}) {
  if (!dbEnabled) return;
  await ensureSchema();
  await getPool().query(
    `insert into profiles (sub, name, email, picture, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (sub) do update set
       name = excluded.name,
       email = excluded.email,
       picture = excluded.picture,
       updated_at = now()`,
    [p.sub, p.name ?? null, p.email ?? null, p.picture ?? null],
  );
}

export async function saveImport(sub: string, result: ImportResult) {
  if (!dbEnabled) return;
  await ensureSchema();
  await getPool().query(
    `insert into profiles (sub, import_json, imported_at, updated_at)
     values ($1, $2, now(), now())
     on conflict (sub) do update set
       import_json = excluded.import_json,
       imported_at = excluded.imported_at,
       updated_at = now()`,
    [sub, JSON.stringify(result)],
  );
}

export async function deleteProfile(sub: string) {
  if (!dbEnabled) return;
  await ensureSchema();
  await getPool().query("delete from profiles where sub = $1", [sub]);
}
