// Server entry point.
import app from './app';
import env from './config/env';
import prisma from './prisma/client';

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected');

    app.listen(env.port, () => {
      console.log(`Backend running on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();