const { Queue, Worker } = require('bullmq');
const config = require('../config');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
};

const queues = {
  email: new Queue('email', { connection }),
  whatsapp: new Queue('whatsapp', { connection }),
  sms: new Queue('sms', { connection }),
  campaign: new Queue('campaign', { connection }),
  'email-sequence': new Queue('email-sequence', { connection }),
  import: new Queue('import', { connection }),
  notification: new Queue('notification', { connection }),
  reengagement: new Queue('reengagement', { connection }),
};

async function enqueueJob(queueName, data, options = {}) {
  try {
    const queue = queues[queueName] || queues.email;
    const job = await queue.add(queueName, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...options,
    });
    logger.info(`Job enqueued: ${queueName} - ${job.id}`);
    return job;
  } catch (err) {
    logger.error('Enqueue error:', err.message);
    throw err;
  }
}

module.exports = { queues, enqueueJob, connection };
