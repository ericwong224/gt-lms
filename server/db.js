import pg from 'pg';
import { normalizeDatabaseUrl } from './dbUrl.js';

const { Pool } = pg;

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString,
  max: 25,
  connectionTimeoutMillis: 30_000,
  idleTimeoutMillis: 30_000,
});

pool.on('connect', (client) => {
  client.query('SET search_path TO public').catch(() => {});
});

export async function q(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function q1(text, params) {
  const rows = await q(text, params);
  return rows[0] || null;
}
