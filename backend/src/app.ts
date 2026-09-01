// Express application - modular monolith entry point.
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import env from './config/env';
import prisma from './prisma/client';
import authRoutes from './routes/authRoutes';
import libraryRoutes from './routes/libraryRoutes';
import courseRoutes from './routes/courseRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import quizRoutes from './routes/quizRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import timetableRoutes from './routes/timetableRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import notificationRoutes from './routes/notificationRoutes';
import communicationRoutes from './routes/communicationRoutes';
import userAdminRoutes from './routes/userAdminRoutes';
import errorHandler from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';

const app = express();

// Behind a reverse proxy, req.ip resolves to the proxy's IP unless trust
// proxy is configured - which would bucket every user into one rate-limit
// key and record the proxy IP in audit logs. Set TRUST_PROXY to the number
// of proxy hops (e.g. TRUST_PROXY=1). Never default to true: a
// client-controlled X-Forwarded-For would make limits bypassable.
if (env.trustProxy !== '') {
  app.set('trust proxy', Number(env.trustProxy));
}

// Middleware
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
// Basic DoS protection for the whole API surface.
app.use('/api', apiLimiter);

// Request logging (structured JSON lines with a request id and actor)
app.use((req, res, next) => {
  (req as any).id = crypto.randomUUID();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      JSON.stringify({
        id: (req as any).id,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        userId: (req as any).user?.id ?? null,
      })
    );
  });
  next();
});

// Health endpoint - also pings the database so a broken DB connection fails
// the platform health check (503) instead of reporting a healthy app.
app.get('/api/health', async (req, res) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB ping timeout')), 5000)),
    ]);
    res.status(200).json({
      success: true,
      message: 'Service is healthy',
      data: { status: 'ok', database: 'ok', timestamp: new Date().toISOString() },
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'Service is unhealthy',
      data: { status: 'error', database: 'unreachable', timestamp: new Date().toISOString() },
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', assignmentRoutes);
app.use('/api', quizRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', timetableRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', notificationRoutes);
app.use('/api', communicationRoutes);
app.use('/api', userAdminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    data: {},
  });
});

// Central error handler
app.use(errorHandler);

export default app;

