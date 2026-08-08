// Shared Prisma client - single instance for the entire backend.
// Do not instantiate PrismaClient anywhere else.
// Uses DIRECT_URL (session pooler) to avoid pgbouncer prepared statement issues.

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL,
    },
  },
});

export default prisma;