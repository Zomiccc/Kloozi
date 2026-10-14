const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  webUrl: process.env.WEB_URL || 'http://localhost:3000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  appName: process.env.APP_NAME || 'Flazyn',
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
  supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,ur,ar').split(','),
  autoLogoutMinutes: parseInt(process.env.AUTO_LOGOUT_MINUTES, 10) || 60,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'crm_final',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@flazyn.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'Flazyn',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    prices: {
      free: process.env.STRIPE_PRICE_FREE || '',
      pro: process.env.STRIPE_PRICE_PRO || '',
      team: process.env.STRIPE_PRICE_TEAM || '',
      business: process.env.STRIPE_PRICE_BUSINESS || '',
    },
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'flazyn-uploads',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  firebase: (() => {
    const projectId = process.env.FIREBASE_PROJECT_ID || '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    
    if (projectId && clientEmail && privateKey) {
      return { projectId, clientEmail, privateKey };
    }
    
    try {
      const fs = require('fs');
      const path = require('path');
      const saPath = path.resolve(__dirname, '../../firebase-service-account.json');
      if (fs.existsSync(saPath)) {
        const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
        return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
      }
    } catch (e) {}
    
    return { projectId: '', clientEmail: '', privateKey: '' };
  })(),

  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v25.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    businessId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WHATSAPP_BUSINESS_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    mode: process.env.WHATSAPP_MODE || 'sandbox',
  },

  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || '',
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION || 'v25.0',
    // Facebook Login for Business: permissions live in a dashboard "Configuration"
    loginConfigId: process.env.FACEBOOK_LOGIN_CONFIG_ID || '',
  },

  tiktok: {
    appId: process.env.TIKTOK_APP_ID || '',
    appSecret: process.env.TIKTOK_APP_SECRET || '',
  },

  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    apiVersion: process.env.LINKEDIN_API_VERSION || '202609',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
};
