// Express application - modular monolith entry point.
import express from 'express';
import cors from 'cors';
import env from './config/env';
import authRoutes from './routes/authRoutes';
import libraryRoutes from './routes/libraryRoutes';
import courseRoutes from './routes/courseRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import quizRoutes from './routes/quizRoutes';
import errorHandler from './middleware/errorHandler';

const app = express();

// Middleware
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());

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