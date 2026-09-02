// Environment configuration - loads and validates required env vars.
import dotenv from 'dotenv';

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

// The shared Prisma client hard-requires DIRECT_URL (datasources.db.url);
// fail fast instead of a confusing runtime datasource error.
if (!process.env.DIRECT_URL) {
  throw new Error('DIRECT_URL must be set - the Prisma client connects through it');
}

const env = {
  nodeEnv,
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // 12h default: every request re-validates the user row in the DB, but a
  // shorter token limits the theft window (logout is client-side only).
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
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

export default env;