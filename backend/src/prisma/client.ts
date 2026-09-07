// Shared Prisma client - single instance for the entire backend.
// Do not instantiate PrismaClient anywhere else.
//
// H13: the app talks to DATABASE_URL (the pooler, e.g. Supabase port 6543)
// so platform connection limits hold under load; migrations and the seed
// script use DIRECT_URL (the direct database connection). The old wiring
// had this backwards - every Node process opened direct connections,
// bypassing pooling entirely. Falls back to DIRECT_URL with a loud warning
// so existing single-URL deployments keep booting.
//
// Pool sizing: append ?connection_limit=N to DATABASE_URL. Size it as
// (instances x ~5 connections) + headroom so one process cannot exhaust
// the pool.

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const poolerUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

if (!poolerUrl && directUrl) {
  console.warn(
    'DATABASE_URL is not set - falling back to DIRECT_URL for app queries. ' +
      'Set DATABASE_URL to the pooler URL (e.g. Supabase port 6543) to bound connection usage.'
  );
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: poolerUrl || directUrl,
    },
  },
});

export default prisma;
