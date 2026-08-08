// Auth controller - handles login and current user requests.
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { success } from '../utils/response';

async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(422).json({
        success: false,
        message: 'Email and password are required',
        data: {},
      });
      return;
    }
    const result = await authService.login({ email, password });
    success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    success(res, { user }, 'Current user retrieved');
  } catch (err) {
    next(err);
  }
}

export { login, me };