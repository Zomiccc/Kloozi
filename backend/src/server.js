const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const corsOptions = require('./middleware/cors');

const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const emailRoutes = require('./routes/emails');
const campaignRoutes = require('./routes/campaigns');
const whatsappRoutes = require('./routes/whatsapp');
const smsRoutes = require('./routes/sms');
const callRoutes = require('./routes/calls');
const followUpRoutes = require('./routes/followups');
const contentRoutes = require('./routes/content');
const analyticsRoutes = require('./routes/analytics');
const teamRoutes = require('./routes/team');
const billingRoutes = require('./routes/billing');
const integrationRoutes = require('./routes/integrations');
const automationRoutes = require('./routes/automations');
const { getTranslations, getAvailableLanguages } = require('./utils/i18n');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: corsOptions.origin,
    credentials: true,
  },
});

app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/automations', automationRoutes);

app.get('/api/translations/:lang', (req, res) => {
  res.json({ translations: getTranslations(req.params.lang) });
});
app.get('/api/translations', (req, res) => {
  res.json({ languages: getAvailableLanguages() });
});

app.use('/api', apiLimiter);

// Serve frontend in production
if (config.env === 'production' || config.env === 'staging') {
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }
}

app.use(notFound);
app.use(errorHandler);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, config.jwt.secret);
    socket.userId = decoded.userId;
    socket.workspaceId = decoded.workspaceId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} - User: ${socket.userId}`);

  socket.join(`workspace:${socket.workspaceId}`);
  socket.join(`user:${socket.userId}`);

  socket.on('join-lead', (leadId) => {
    socket.join(`lead:${leadId}`);
  });

  socket.on('leave-lead', (leadId) => {
    socket.leave(`lead:${leadId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

app.set('io', io);

const PORT = config.port;
server.listen(PORT, () => {
  logger.info(`CRM Final API running on port ${PORT}`);
  logger.info(`Environment: ${config.env}`);
});

module.exports = { app, server, io };
