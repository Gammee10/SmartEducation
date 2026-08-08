// Central error handler - catches all errors and returns standard API shape.
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import env from '../config/env';

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): Response {
  // Prisma known errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as Error & { code?: string };
    if (prismaErr.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A record with this value already exists',
        data: {},
      });
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
        data: {},
      });
    }
  }

  // Operational errors we created
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      data: {},
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      data: {},
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      data: {},
    });
  }

  // Unknown errors - log and return generic message
  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: env.nodeEnv === 'production' ? 'Internal server error' : err.message,
    data: {},
  });
}

export default errorHandler;