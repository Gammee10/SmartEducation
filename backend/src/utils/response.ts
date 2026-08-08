// Standard API response helpers.
// All API responses use the shape: { success, message, data }

import { Response } from 'express';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function success(res: Response, data: unknown = {}, message = 'Operation completed successfully', status = 200): Response {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

function created(res: Response, data: unknown = {}, message = 'Resource created successfully'): Response {
  return success(res, data, message, 201);
}

function paginated(res: Response, data: unknown[] = [], pagination: Pagination = {} as Pagination, message = 'Operation completed successfully'): Response {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
}

export { success, created, paginated };