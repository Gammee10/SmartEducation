// Role-based access control middleware.
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

// requireRole('ADMIN') or requireRole('ADMIN', 'TEACHER')
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
}

// requireAdmin - convenience wrapper
const requireAdmin = requireRole('ADMIN');

// requireStudent - convenience wrapper
const requireStudent = requireRole('STUDENT');

// requireTeacher - convenience wrapper
const requireTeacher = requireRole('TEACHER');

export { requireRole, requireAdmin, requireStudent, requireTeacher };