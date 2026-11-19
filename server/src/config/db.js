import pg from 'pg';
import { env } from './env.js';

pg.types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
