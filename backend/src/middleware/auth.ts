// Authentication middleware - verifies JWT and attaches req.user.
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import prisma from '../prisma/client';
import { UnauthorizedError } from '../utils/errors';

async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required');
    }

    const token = header.split(' ')[1];
    let payload: { sub: string };
    try {
      payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        student: { select: { id: true, studentCode: true, gradeLevel: true, section: true } },
        teacher: { select: { id: true, employeeCode: true, subject: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    req.user = user as Express.Request['user'];
    next();
  } catch (err) {
    next(err);
  }
}

export default authenticate;