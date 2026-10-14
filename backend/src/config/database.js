const { Pool, types, defaults } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

// All times are UTC end-to-end, whatever timezone the Postgres server or the
// Node host happens to run in: sessions use UTC, TIMESTAMP (without zone)
// values are read as UTC, and JS Dates are written as UTC.
types.setTypeParser(1114, (v) => (v === null ? null : new Date(`${v.replace(' ', 'T')}Z`)));
defaults.parseInputDatesAsUTC = true;

const pool = new Pool({
  options: '-c timezone=UTC',
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  min: config.db.poolMin,
  max: config.db.poolMax,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
});

async function query(text, params = []) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 1000) {
    logger.warn(`Slow query (${duration}ms): ${text.substring(0, 200)}`);
  }
  
  return result;
}

function getClient() {
  return pool.connect();
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, getClient, transaction, pool };