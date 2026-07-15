const Redis = require('ioredis');
const config = require('./index');

const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

if (config.redis.password) {
  redisConfig.password = config.redis.password;
}

const redis = new Redis(redisConfig);

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

async function cacheGet(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttl = 300) {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.error('Redis cache set error:', err.message);
  }
}

async function cacheDel(key) {
  try {
    await redis.del(key);
  } catch (err) {
    console.error('Redis cache del error:', err.message);
  }
}

async function cacheDelPattern(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error('Redis cache delPattern error:', err.message);
  }
}

module.exports = { redis, cacheGet, cacheSet, cacheDel, cacheDelPattern };
