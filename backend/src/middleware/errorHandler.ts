// Central error handler - catches all errors and returns standard API shape.
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import env from '../config/env';
import logger, { redactUrl } from '../utils/logger';
import { captureError } from '../utils/errorTracker';

function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): Response {
  res.setHeader('x-request-id', (req as any).id ?? '');

  // Prisma known errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as Error & { code?: string };
    if (prismaErr.code === 'P2002') {
      // Map known unique-constraint targets to friendly messages (fallback
      // for sites without a local catch)
      const target = JSON.stringify((prismaErr as any).meta?.target || '');
      const message = target.includes('email')
        ? 'A user with this email already exists'
        : 'A record with this value already exists';
      return res.status(409).json({
        success: false,
        message,
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
    if (prismaErr.code === 'P2023') {
      // Malformed identifier (e.g. a non-UUID path param hitting a Uuid
      // column) must never surface as a raw 500 - treat it as not found.
      return res.status(404).json({
        success: false,
        message: 'Record not found',
        data: {},
      });
    }
    if (prismaErr.code === 'P2003') {
      // Defense-in-depth (C4): with Restrict FKs (C1) any delete that would
      // orphan history fails here. Never leak a raw 500 for it - the caller
      // must use the archival flow or resolve dependents first.
      return res.status(409).json({
        success: false,
        message: 'This record cannot be deleted because other records depend on it',
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

  // Body parser limit exceeded (express.json)
  if ((err as any).type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request body is too large',
      data: {},
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

  // Unknown errors - M16: leveled log with redacted URL and no stack in
  // production (stacks stay in the error tracker with the request id).
  const requestId = (req as any).id ?? null;
  logger.error('unhandled error', {
    requestId,
    method: req.method,
    url: redactUrl(req.originalUrl),
    userId: (req as any).user?.id ?? null,
    message: err.message,
    ...(env.nodeEnv === 'production' ? {} : { stack: err.stack }),
  });
  captureError(err, { requestId });
  return res.status(500).json({
    success: false,
    message: env.nodeEnv === 'production' ? 'Internal server error' : err.message,
    data: {},
  });
}

export default errorHandler;