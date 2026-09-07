// Server entry point.
import app from './app';
import env from './config/env';
import prisma from './prisma/client';
import logger from './utils/logger';
import { initErrorTracker } from './utils/errorTracker';

initErrorTracker();

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('database connected');

    const server = app.listen(env.port, () => {
      logger.info('backend listening', { port: env.port });
    });

    // Graceful shutdown: stop accepting new connections, let in-flight
    // requests finish, drain DB connections, then exit. A hard timeout
    // guarantees the process never hangs the deploy.
    const shutdown = (signal: string) => {
      logger.info('shutdown signal received', { signal });
      server.close(async () => {
        try {
          await prisma.$disconnect();
        } catch (err) {
          logger.error('error disconnecting Prisma', { message: (err as Error).message });
        }
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('failed to start server', { message: (err as Error).message });
    process.exit(1);
  }
}

start();