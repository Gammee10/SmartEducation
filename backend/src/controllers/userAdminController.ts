import { parsePagination } from '../utils/pagination';
// User admin controller - admin user management and CSV import (Member 6).
import { Request, Response, NextFunction } from 'express';
import * as userAdminService from '../services/userAdminService';
import { success, created } from '../utils/response';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role, status, search } = req.query;
    const result = await userAdminService.listUsers({
      role: role as string | undefined,
      status: status as string | undefined,
      search: search as string | undefined,
      ...parsePagination(req.query),
    });
    success(res, result, 'Users retrieved');
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userAdminService.createUser({
      actorId: req.user!.id,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { user }, 'User created');
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userAdminService.updateUser({
      actorId: req.user!.id,
      userId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { user }, 'User updated');
  } catch (err) {
    next(err);
  }
}

export async function archiveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userAdminService.archiveUser({
      actorId: req.user!.id,
      userId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, { user }, 'User archived');
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await userAdminService.resetUserPassword({
      actorId: req.user!.id,
      userId: req.params.id as string,
      ipAddress: getIp(req),
    });
    success(res, result, 'Temporary password generated. Share it with the user securely.');
  } catch (err) {
    next(err);
  }
}

export async function importUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    const filename = typeof req.body?.filename === 'string' ? req.body.filename : 'upload.csv';
    const result = await userAdminService.importUsersCsv({
      actorId: req.user!.id,
      csv,
      filename,
      ipAddress: getIp(req),
    });
    created(res, { import: result }, `Import finished: ${result.successCount} created, ${result.errorCount} failed`);
  } catch (err) {
    next(err);
  }
}