import { parsePagination } from '../utils/pagination';
// Library controller - handles book, request, and loan HTTP requests.
import { Request, Response, NextFunction } from 'express';
import * as libraryService from '../services/libraryService';
import { success, created, paginated } from '../utils/response';
import { ForbiddenError } from '../utils/errors';

function getIp(req: Request): string | null {
  return req.ip || req.socket?.remoteAddress || null;
}

// ---------------------------------------------------------------
// Books
// ---------------------------------------------------------------

async function listBooks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, category } = req.query;
    const result = await libraryService.listBooks({
      search: search as string | undefined,
      category: category as string | undefined,
      ...parsePagination(req.query),
    });
    paginated(res, result.books, result.pagination, 'Books retrieved');
  } catch (err) {
    next(err);
  }
}

async function getBook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const book = await libraryService.getBook(req.params.id as string);
    success(res, { book }, 'Book retrieved');
  } catch (err) {
    next(err);
  }
}

async function createBook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const book = await libraryService.createBook({
      actorId: req.user!.id,
      data: req.body,
      ipAddress: getIp(req),
    });
    created(res, { book }, 'Book created');
  } catch (err) {
    next(err);
  }
}

async function updateBook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const book = await libraryService.updateBook({
      actorId: req.user!.id,
      bookId: req.params.id as string,
      data: req.body,
      ipAddress: getIp(req),
    });
    success(res, { book }, 'Book updated');
  } catch (err) {
    next(err);
  }
}

async function addCopies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = parseInt(req.body.count, 10) || 1;
    const result = await libraryService.addCopies({
      actorId: req.user!.id,
      bookId: req.params.id as string,
      count,
      ipAddress: getIp(req),
    });
    success(res, { count: result.count }, 'Copies added');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Borrow Requests
// ---------------------------------------------------------------

async function createBorrowRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'STUDENT' || !req.user!.student) {
      next(new ForbiddenError('Only students can request books'));
      return;
    }
    const request = await libraryService.createBorrowRequest({
      studentId: req.user!.student.id,
      actorId: req.user!.id,
      bookCopyId: req.body.bookCopyId,
      reason: req.body.reason,
      ipAddress: getIp(req),
    });
    created(res, { request }, 'Borrow request submitted');
  } catch (err) {
    next(err);
  }
}

async function listBorrowRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.query;
    const result = await libraryService.listBorrowRequests({
      status: status as string | undefined,
      ...parsePagination(req.query),
    });
    paginated(res, result.requests, result.pagination, 'Borrow requests retrieved');
  } catch (err) {
    next(err);
  }
}

async function listMyBorrowRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'STUDENT' || !req.user!.student) {
      next(new ForbiddenError('Only students can view their borrow requests'));
      return;
    }
    const result = await libraryService.listMyBorrowRequests({
      studentId: req.user!.student.id,
      ...parsePagination(req.query),
    });
    paginated(res, result.requests, result.pagination, 'Your borrow requests retrieved');
  } catch (err) {
    next(err);
  }
}

async function decideBorrowRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { decision, reason, dueDate } = req.body;
    const result = await libraryService.decideBorrowRequest({
      actorId: req.user!.id,
      requestId: req.params.id as string,
      decision,
      reason,
      dueDate,
      ipAddress: getIp(req),
    });
    success(res, result, `Borrow request ${decision.toLowerCase()}`);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Loans
// ---------------------------------------------------------------

async function listLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.query;
    const result = await libraryService.listLoans({
      status: status as string | undefined,
      ...parsePagination(req.query),
    });
    paginated(res, result.loans, result.pagination, 'Loans retrieved');
  } catch (err) {
    next(err);
  }
}

async function listMyLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'STUDENT' || !req.user!.student) {
      next(new ForbiddenError('Only students can view their loans'));
      return;
    }
    const result = await libraryService.listMyLoans({
      studentId: req.user!.student.id,
      ...parsePagination(req.query),
    });
    paginated(res, result.loans, result.pagination, 'Your loans retrieved');
  } catch (err) {
    next(err);
  }
}

async function returnLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const loan = await libraryService.returnLoan({
      actorId: req.user!.id,
      loanId: req.params.id as string,
      notes: req.body.notes,
      ipAddress: getIp(req),
    });
    success(res, { loan }, 'Loan returned');
  } catch (err) {
    next(err);
  }
}

export {
  listBooks,
  getBook,
  createBook,
  updateBook,
  addCopies,
  createBorrowRequest,
  listBorrowRequests,
  listMyBorrowRequests,
  decideBorrowRequest,
  listLoans,
  listMyLoans,
  returnLoan,
};