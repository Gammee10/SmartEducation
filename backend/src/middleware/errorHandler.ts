// Central error handler - catches all errors and returns standard API shape.
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import env from '../config/env';

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): Response {
  res.setHeader('x-request-id', (req as any).id ?? '');

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

  // File upload errors from multer
  if (err.name === 'MulterError') {
    const multerErr = err as Error & { code?: string };
    const message =
      multerErr.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large (maximum 20MB)'
        : 'File upload failed';
    return res.status(422).json({
      success: false,
      message,
      data: {},
    });
  }

  // Unknown errors - log with request context and return generic message
  console.error(
    JSON.stringify({
      requestId: (req as any).id ?? null,
      method: req.method,
      url: req.originalUrl,
      userId: (req as any).user?.id ?? null,
      message: err.message,
      stack: err.stack,
    })
  );
  return res.status(500).json({
    success: false,
    message: env.nodeEnv === 'production' ? 'Internal server error' : err.message,
    data: {},
  });
}

export default errorHandler;