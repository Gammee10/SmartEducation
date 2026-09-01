// Express application - modular monolith entry point.
import express from 'express';
import cors from 'cors';
import env from './config/env';
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

// Request logging (lightweight)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy',
    data: { status: 'ok', timestamp: new Date().toISOString() },
  });
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

