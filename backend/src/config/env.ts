// Environment configuration - loads and validates required env vars.
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

// In production a real JWT secret is mandatory; tokens signed with a
// publicly-known default would let anyone forge authentication tokens.
if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV is production');
}

// Without this, admin-created/CSV-imported users would fall back to a
// publicly-known default password in production.
if (nodeEnv === 'production' && !process.env.DEFAULT_USER_PASSWORD) {
  throw new Error('DEFAULT_USER_PASSWORD must be set when NODE_ENV is production');
}

// H13: the app runs queries through DATABASE_URL (the pooler) and only
// migrations/seed use DIRECT_URL. Production needs at least one database
// URL to boot; missing DATABASE_URL falls back to DIRECT_URL with a loud
// warning in the Prisma client (existing single-URL deploys keep working).
// In development only warn, because a fresh clone without a .env file must
// still be able to run the unit tests (which mock the Prisma client and
// never touch the database).
if (nodeEnv === 'production' && !process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  throw new Error('DATABASE_URL (pooler) must be set when NODE_ENV is production');
} else if (!process.env.DATABASE_URL) {
  logger.warn('DATABASE_URL is not set - database connections will fail until it is provided.');
}
if (!process.env.DIRECT_URL) {
  logger.warn('DIRECT_URL is not set - migrations and seeding require the direct database URL.');
}

// M13: multi-origin CORS. Staging + prod + preview URLs are a
// comma-separated list (CLIENT_URLS); CLIENT_URL is kept as a single-origin
// fallback. Production origins must be https:// - an http:// origin in prod
// is a fail-fast boot error, not a silent downgrade.
const clientUrls = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (nodeEnv === 'production') {
  for (const origin of clientUrls) {
    if (!origin.startsWith('https://')) {
      throw new Error(`CLIENT_URLS origin "${origin}" must use https:// when NODE_ENV is production`);
    }
  }
}

const env = {
  nodeEnv,
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // 12h default: every request re-validates the user row in the DB, but a
  // shorter token limits the theft window (logout is client-side only).
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Preferred multi-origin list (M13); clientUrl is the legacy single value.
  clientUrls,
  // Number of proxy hops in front of the API (e.g. "1" for one reverse
  // proxy). Empty string means direct exposure - never guess "true", a
  // client-controlled X-Forwarded-For would make rate limits bypassable and
  // audit IPs forgeable.
  trustProxy: process.env.TRUST_PROXY || '',
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  // Initial password for admin-created/CSV-imported users who are not given
  // an explicit password. Deployments should set this to something private
  // instead of relying on the built-in fallback.
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD || '',
};

// C3 fail-fast: behind any hosted proxy (Render/Fly/Railway) req.ip is the
// proxy IP unless TRUST_PROXY is set, which collapses the IP-keyed edge
// limiter into one global bucket (one busy NAT locks out all logins) and
// records the proxy IP in audit logs. Refuse to boot in that situation;
// otherwise log a loud warning so single-server prod deploys notice too.
if (nodeEnv === 'production' && (process.env.TRUST_PROXY || '') === '') {
  const managedProxy =
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.FLY_APP_NAME || process.env.RAILWAY_ENVIRONMENT;
  const message =
    'TRUST_PROXY is not set: behind a reverse proxy all clients share one rate-limit bucket and audit IPs will record the proxy. Set TRUST_PROXY to the number of proxy hops (e.g. TRUST_PROXY=1).';
  if (managedProxy) {
    throw new Error(message);
  }
  logger.warn(`production without TRUST_PROXY: ${message}`);
}

export default env;