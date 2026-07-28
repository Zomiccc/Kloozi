const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool({
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