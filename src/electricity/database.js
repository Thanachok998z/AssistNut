const { Pool } = require('pg');

let pool;
let schemaPromise;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS meter_readings (
          id BIGSERIAL PRIMARY KEY,
          line_user_id TEXT NOT NULL,
          meter_reading NUMERIC(14, 3) NOT NULL CHECK (meter_reading >= 0),
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS meter_readings_user_latest_idx
          ON meter_readings (line_user_id, recorded_at DESC, id DESC);
        CREATE TABLE IF NOT EXISTS pending_meter_readings (
          id BIGSERIAL PRIMARY KEY,
          line_user_id TEXT NOT NULL,
          meter_reading NUMERIC(14, 3) NOT NULL CHECK (meter_reading >= 0),
          previous_reading NUMERIC(14, 3),
          usage NUMERIC(14, 3),
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          confirmed_at TIMESTAMPTZ,
          cancelled_at TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pending_meter_readings_one_active_idx
          ON pending_meter_readings (line_user_id) WHERE status = 'PENDING';
      `);
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

async function withTransaction(work) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { getPool, ensureSchema, withTransaction };
