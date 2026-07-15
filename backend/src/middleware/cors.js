const config = require('../config');

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      config.webUrl,
      config.clientUrl,
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:19006',
      'capacitor://localhost',
      'http://localhost',
    ];
    if (!origin || allowedOrigins.includes(origin) || config.env === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Workspace-Id'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};

module.exports = corsOptions;
