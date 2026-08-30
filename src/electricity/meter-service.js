const { ensureSchema, getPool, withTransaction } = require('./database');

async function latestReading(client, lineUserId) {
  const { rows } = await client.query(
    `SELECT meter_reading, recorded_at
     FROM meter_readings
     WHERE line_user_id = $1
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1`,
    [lineUserId]
  );
  return rows[0] || null;
}

async function createPendingMeter(lineUserId, meterReading) {
  return withTransaction(async (client) => {
    const previous = await latestReading(client, lineUserId);
    const previousReading = previous ? Number(previous.meter_reading) : null;
    if (previousReading !== null && meterReading < previousReading) {
      return { kind: 'decreased', previousReading };
    }
    const usage = previousReading === null ? null : meterReading - previousReading;
    await client.query(
      `UPDATE pending_meter_readings
       SET status = 'CANCELLED', cancelled_at = NOW()
       WHERE line_user_id = $1 AND status = 'PENDING'`,
      [lineUserId]
    );
    const { rows } = await client.query(
      `INSERT INTO pending_meter_readings
       (line_user_id, meter_reading, previous_reading, usage, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING id, meter_reading, previous_reading, usage, created_at`,
      [lineUserId, meterReading, previousReading, usage]
    );
    return { kind: 'pending', pending: rows[0] };
  });
}

async function confirmPendingMeter(lineUserId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, meter_reading
       FROM pending_meter_readings
       WHERE line_user_id = $1 AND status = 'PENDING'
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [lineUserId]
    );
    const pending = rows[0];
    if (!pending) return { confirmed: false };

    await client.query(
      `INSERT INTO meter_readings (line_user_id, meter_reading, recorded_at)
       VALUES ($1, $2, NOW())`,
      [lineUserId, pending.meter_reading]
    );
    await client.query(
      `UPDATE pending_meter_readings
       SET status = 'CONFIRMED', confirmed_at = NOW()
       WHERE id = $1 AND status = 'PENDING'`,
      [pending.id]
    );
    return { confirmed: true };
  });
}

async function cancelPendingMeter(lineUserId) {
  await ensureSchema();
  const { rowCount } = await getPool().query(
    `UPDATE pending_meter_readings
     SET status = 'CANCELLED', cancelled_at = NOW()
     WHERE line_user_id = $1 AND status = 'PENDING'`,
    [lineUserId]
  );
  return rowCount > 0;
}

module.exports = { createPendingMeter, confirmPendingMeter, cancelPendingMeter };
