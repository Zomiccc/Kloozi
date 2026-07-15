const logger = require('../utils/logger');

const memCache = new Map();

logger.info('Using in-memory cache (Redis not available)');

async function cacheGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

async function cacheSet(key, value, ttl = 300) {
  memCache.set(key, {
    value,
    expiresAt: Date.now() + (ttl * 1000),
  });
}

async function cacheDel(key) {
  memCache.delete(key);
}

async function cacheDelPattern(pattern) {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  for (const key of memCache.keys()) {
    if (regex.test(key)) memCache.delete(key);
  }
}

module.exports = { redis: null, cacheGet, cacheSet, cacheDel, cacheDelPattern };
