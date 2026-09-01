// Server entry point.
import app from './app';
import env from './config/env';
import prisma from './prisma/client';

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected');

    const server = app.listen(env.port, () => {
      console.log(`Backend running on http://localhost:${env.port}`);
    });

    // Graceful shutdown: stop accepting new connections, let in-flight
    // requests finish, drain DB connections, then exit. A hard timeout
    // guarantees the process never hangs the deploy.
    const shutdown = (signal: string) => {
      console.log(`${signal} received, shutting down`);
      server.close(async () => {
        try {
          await prisma.$disconnect();
        } catch (err) {
          console.error('Error disconnecting Prisma:', err);
        }
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();