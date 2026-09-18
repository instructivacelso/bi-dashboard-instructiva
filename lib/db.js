import pg from 'pg';

// Datas (DATE) voltam como texto 'YYYY-MM-DD' para evitar erro de fuso
pg.types.setTypeParser(1082, (v) => v);
// NUMERIC volta como número
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const g = globalThis;
export const pool =
  g.__biPool ||
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
  });
if (process.env.NODE_ENV !== 'production') g.__biPool = pool;

export async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

export async function q1(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows[0] || null;
}

export async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
