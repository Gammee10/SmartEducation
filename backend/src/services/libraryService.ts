// Library service - catalog, search, borrow requests, approvals, loans, returns.
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { assertOptionalHttpUrl } from '../utils/url';
import { writeAuditLog } from './auditService';

// ---------------------------------------------------------------
// Books & Catalog
// ---------------------------------------------------------------

interface ListBooksParams {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

async function listBooks({ search, category, page = 1, pageSize = 20 }: ListBooksParams) {
  const where: Prisma.LibraryBookWhereInput = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
      { isbn: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) {
    where.category = category;
  }

  const [books, total] = await Promise.all([
    prisma.libraryBook.findMany({
      where,
      include: {
        copies: {
          select: { id: true, copyNumber: true, status: true, location: true },
        },
      },
      orderBy: { title: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryBook.count({ where }),
  ]);

  return {
    books,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function getBook(bookId: string) {
  const book = await prisma.libraryBook.findUnique({
    where: { id: bookId },
    include: {
      copies: {
        select: { id: true, copyNumber: true, status: true, condition: true, location: true },
      },
    },
  });
  if (!book) throw new NotFoundError('Book not found');
  return book;
}

interface CreateBookParams {
  actorId: string;
  data: {
    title: string;
    author: string;
    isbn?: string;
    publisher?: string;
    publishedYear?: string | number;
    category?: string;
    description?: string;
    coverUrl?: string;
    copies?: string | number;
  };
  ipAddress?: string | null;
}

async function createBook({ actorId, data, ipAddress }: CreateBookParams) {
  const { title, author, isbn, publisher, publishedYear, category, description, coverUrl, copies = 1 } = data;

  if (!title || !author) {
    throw new ValidationError('Title and author are required');
  }

  const book = await prisma.libraryBook.create({
    data: {
      title,
      author,
      isbn: isbn || null,
      publisher: publisher || null,
      publishedYear: publishedYear ? parseInt(String(publishedYear), 10) : null,
      category: category || null,
      description: description || null,
      coverUrl: assertOptionalHttpUrl(coverUrl, 'Cover URL'),
      createdById: actorId,
      copies: {
        create: Array.from({ length: Math.max(1, parseInt(String(copies), 10) || 1) }, (_, i) => ({
          copyNumber: String(i + 1),
          createdById: actorId,
        })),
      },
    },
    include: { copies: true },
  });

  await writeAuditLog({
    actorId,
    action: 'LIBRARY_BOOK_CREATED',
    entity: 'LibraryBook',
    entityId: book.id,
    metadata: { title, author, copies: book.copies.length },
    ipAddress,
  });

  return book;
}

interface UpdateBookParams {
  actorId: string;
  bookId: string;
  data: {
    title?: string;
    author?: string;
    isbn?: string;
    publisher?: string;
    publishedYear?: string | number;
    category?: string;
    description?: string;
    coverUrl?: string;
  };
  ipAddress?: string | null;
}

async function updateBook({ actorId, bookId, data, ipAddress }: UpdateBookParams) {
  const existing = await prisma.libraryBook.findUnique({ where: { id: bookId } });
  if (!existing) throw new NotFoundError('Book not found');

  const book = await prisma.libraryBook.update({
    where: { id: bookId },
    data: {
      title: data.title ?? existing.title,
      author: data.author ?? existing.author,
      isbn: data.isbn !== undefined ? data.isbn : existing.isbn,
      publisher: data.publisher !== undefined ? data.publisher : existing.publisher,
      publishedYear: data.publishedYear !== undefined ? parseInt(String(data.publishedYear), 10) : existing.publishedYear,
      category: data.category !== undefined ? data.category : existing.category,
      description: data.description !== undefined ? data.description : existing.description,
      coverUrl: data.coverUrl !== undefined ? assertOptionalHttpUrl(data.coverUrl, 'Cover URL') : existing.coverUrl,
    },
  });

  await writeAuditLog({
    actorId,
    action: 'LIBRARY_BOOK_UPDATED',
    entity: 'LibraryBook',
    entityId: book.id,
    metadata: { title: book.title },
    ipAddress,
  });

  return book;
}

interface AddCopiesParams {
  actorId: string;
  bookId: string;
  count: number;
  ipAddress?: string | null;
}

async function addCopies({ actorId, bookId, count: rawCount, ipAddress }: AddCopiesParams) {
  // Clamp count so absurd values cannot flood the catalog and NaN falls back
  // to 1; copy numbering requires a numeric run.
  const count = Math.min(500, Math.max(1, Math.floor(Number(rawCount) || 1)));

  const book = await prisma.libraryBook.findUnique({ where: { id: bookId } });
  if (!book) throw new NotFoundError('Book not found');

  const existingCopies = await prisma.libraryBookCopy.findMany({
    where: { bookId },
    select: { copyNumber: true },
    orderBy: { copyNumber: 'desc' },
  });

  // Non-numeric copy numbers would make `start` NaN -> invalid rows.
  const maxNumber = existingCopies.length
    ? existingCopies.reduce((max: number, c: any) => Math.max(max, parseInt(c.copyNumber, 10) || 0), 0)
    : 0;
  const start = maxNumber + 1;
  if (!Number.isFinite(start)) {
    throw new ValidationError('Existing copy numbers are not numeric');
  }
  const copies = await prisma.libraryBookCopy.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      bookId,
      copyNumber: String(start + i),
      createdById: actorId,
    })),
  });

  await writeAuditLog({
    actorId,
    action: 'LIBRARY_COPIES_ADDED',
    entity: 'LibraryBook',
    entityId: bookId,
    metadata: { count },
    ipAddress,
  });

  return copies;
}

// ---------------------------------------------------------------
// Borrow Requests
// ---------------------------------------------------------------

interface CreateBorrowRequestParams {
  studentId: string;
  // Acting user (the student) so the audit log records the actor, not null.
  actorId?: string;
  bookCopyId: string;
  reason?: string;
  ipAddress?: string | null;
}

async function createBorrowRequest({ studentId, actorId, bookCopyId, reason, ipAddress }: CreateBorrowRequestParams) {
  const copy = await prisma.libraryBookCopy.findUnique({
    where: { id: bookCopyId },
    include: { book: true },
  });
  if (!copy) throw new NotFoundError('Book copy not found');
  if (copy.status !== 'AVAILABLE') {
    throw new ConflictError('This book copy is not available for borrowing');
  }

  const existingPending = await prisma.libraryBorrowRequest.findFirst({
    where: { studentId, bookCopyId, status: 'PENDING' },
  });
  if (existingPending) {
    throw new ConflictError('You already have a pending request for this book copy');
  }

  const request = await prisma.libraryBorrowRequest.create({
    data: {
      studentId,
      bookCopyId,
      reason: reason || null,
    },
    include: {
      bookCopy: { include: { book: true } },
    },
  });

  await writeAuditLog({
    actorId: actorId || null,
    action: 'LIBRARY_BORROW_REQUESTED',
    entity: 'LibraryBorrowRequest',
    entityId: request.id,
    metadata: { studentId, bookCopyId, bookTitle: copy.book.title },
    ipAddress,
  });

  return request;
}

interface ListParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

// Known status filter values - invalid filters produce a 422 instead of a
// raw Prisma validation error (500). OVERDUE is a read-time derived filter.
const BORROW_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const LOAN_STATUSES = ['ACTIVE', 'RETURNED', 'OVERDUE'];

function assertBorrowRequestStatus(status: string | undefined) {
  if (status !== undefined && !BORROW_REQUEST_STATUSES.includes(status)) {
    throw new ValidationError('Invalid borrow request status');
  }
  return status;
}

function assertLoanStatus(status: string | undefined) {
  if (status !== undefined && !LOAN_STATUSES.includes(status)) {
    throw new ValidationError('Invalid loan status');
  }
  return status;
}

async function listBorrowRequests({ status, page = 1, pageSize = 20 }: ListParams) {
  const where: Prisma.LibraryBorrowRequestWhereInput = {};
  const validatedStatus = assertBorrowRequestStatus(status);
  if (validatedStatus) where.status = validatedStatus as Prisma.LibraryBorrowRequestWhereInput['status'];

  const [requests, total] = await Promise.all([
    prisma.libraryBorrowRequest.findMany({
      where,
      include: {
        student: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        bookCopy: { include: { book: { select: { id: true, title: true, author: true, isbn: true } } } },
      },
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryBorrowRequest.count({ where }),
  ]);

  return {
    requests,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

interface ListMyBorrowRequestsParams {
  studentId: string;
  page?: number;
  pageSize?: number;
}

async function listMyBorrowRequests({ studentId, page = 1, pageSize = 20 }: ListMyBorrowRequestsParams) {
  const where: Prisma.LibraryBorrowRequestWhereInput = { studentId };

  const [requests, total] = await Promise.all([
    prisma.libraryBorrowRequest.findMany({
      where,
      include: {
        bookCopy: { include: { book: { select: { id: true, title: true, author: true, isbn: true } } } },
      },
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryBorrowRequest.count({ where }),
  ]);

  return {
    requests,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

interface DecideBorrowRequestParams {
  actorId: string;
  requestId: string;
  decision: string;
  reason?: string;
  dueDate?: string;
  ipAddress?: string | null;
}

async function decideBorrowRequest({ actorId, requestId, decision, reason, dueDate, ipAddress }: DecideBorrowRequestParams) {
  const request = await prisma.libraryBorrowRequest.findUnique({
    where: { id: requestId },
    include: { bookCopy: true },
  });
  if (!request) throw new NotFoundError('Borrow request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError('This request has already been decided');
  }

  if (decision === 'APPROVED') {
    if (!dueDate) {
      throw new ValidationError('Due date is required when approving a request');
    }
    if (request.bookCopy.status !== 'AVAILABLE') {
      throw new ConflictError('This book copy is no longer available');
    }

    // Transaction: approve request + create loan + claim copy + audit
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
      // Atomically claim the copy so two admins approving two different
      // pending requests for the same copy cannot both succeed.
      const claimed = await tx.libraryBookCopy.updateMany({
        where: { id: request.bookCopyId, status: 'AVAILABLE' },
        data: { status: 'BORROWED' },
      });
      if (claimed.count === 0) {
        throw new ConflictError('This book copy is no longer available');
      }

      const updatedRequest = await tx.libraryBorrowRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          decidedById: actorId,
          decidedAt: new Date(),
          reason: reason || null,
        },
      });

      const loan = await tx.libraryLoan.create({
        data: {
          borrowReqId: requestId,
          studentId: request.studentId,
          bookCopyId: request.bookCopyId,
          issuedById: actorId,
          dueDate: new Date(dueDate),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'LIBRARY_BORROW_APPROVED',
          entity: 'LibraryBorrowRequest',
          entityId: requestId,
          metadata: { loanId: loan.id, dueDate },
          ipAddress,
        },
      });

      return { request: updatedRequest, loan };
    });
    } catch (err: any) {
      // Two concurrent approvals of the same request: the loan's unique
      // borrowReqId is the authoritative guard.
      if (err?.code === 'P2002') {
        throw new ConflictError('This request has already been approved');
      }
      throw err;
    }

    return result;
  }

  if (decision === 'REJECTED') {
    const updatedRequest = await prisma.libraryBorrowRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedById: actorId,
        decidedAt: new Date(),
        reason: reason || null,
      },
    });

    await writeAuditLog({
      actorId,
      action: 'LIBRARY_BORROW_REJECTED',
      entity: 'LibraryBorrowRequest',
      entityId: requestId,
      metadata: { reason },
      ipAddress,
    });

    return { request: updatedRequest, loan: null };
  }

  throw new ValidationError('Decision must be APPROVED or REJECTED');
}

// ---------------------------------------------------------------
// Loans & Returns
// ---------------------------------------------------------------

// Overdue loans are derived at read time (pilot-appropriate): ACTIVE loans
// whose dueDate has passed are annotated as OVERDUE, and filtering by
// status=OVERDUE returns ACTIVE loans past due. No cron job required.
const now = new Date();

function annotateOverdue(loans: any[]): any[] {
  return loans.map((loan) =>
    loan.status === 'ACTIVE' && new Date(loan.dueDate) < now ? { ...loan, status: 'OVERDUE' } : loan
  );
}

function loanStatusFilter(status?: string): Prisma.LibraryLoanWhereInput['status'] {
  if (status === 'OVERDUE') {
    return undefined;
  }
  return status as Prisma.LibraryLoanWhereInput['status'];
}

async function listLoans({ status, page = 1, pageSize = 20 }: ListParams) {
  const where: Prisma.LibraryLoanWhereInput = {};
  const validatedStatus = assertLoanStatus(status);
  const statusFilter = loanStatusFilter(validatedStatus);
  if (statusFilter) {
    where.status = statusFilter;
  } else if (status === 'OVERDUE') {
    where.status = 'ACTIVE';
    where.dueDate = { lt: now };
  }

  const [loans, total] = await Promise.all([
    prisma.libraryLoan.findMany({
      where,
      include: {
        student: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        bookCopy: { include: { book: { select: { id: true, title: true, author: true, isbn: true } } } },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryLoan.count({ where }),
  ]);

  return {
    loans: annotateOverdue(loans),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

interface ListMyLoansParams {
  studentId: string;
  page?: number;
  pageSize?: number;
}

async function listMyLoans({ studentId, page = 1, pageSize = 20 }: ListMyLoansParams) {
  const where: Prisma.LibraryLoanWhereInput = { studentId };

  const [loans, total] = await Promise.all([
    prisma.libraryLoan.findMany({
      where,
      include: {
        bookCopy: { include: { book: { select: { id: true, title: true, author: true, isbn: true } } } },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryLoan.count({ where }),
  ]);

  return {
    loans: annotateOverdue(loans),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

interface ReturnLoanParams {
  actorId: string;
  loanId: string;
  notes?: string;
  ipAddress?: string | null;
}

async function returnLoan({ actorId, loanId, notes, ipAddress }: ReturnLoanParams) {
  const loan = await prisma.libraryLoan.findUnique({
    where: { id: loanId },
    include: { bookCopy: true },
  });
  if (!loan) throw new NotFoundError('Loan not found');
  if (loan.status === 'RETURNED') {
    throw new ConflictError('This loan has already been returned');
  }

  // Transaction: claim loan (idempotent under concurrency) + mark copy
  // available + audit
  const result = await prisma.$transaction(async (tx) => {
    // Atomically claim the loan so concurrent double-returns cannot both pass
    const claimed = await tx.libraryLoan.updateMany({
      where: { id: loanId, status: { not: 'RETURNED' } },
      data: {
        status: 'RETURNED',
        returnedAt: new Date(),
        returnedById: actorId,
        notes: notes || null,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictError('This loan has already been returned');
    }

    const updatedLoan = await tx.libraryLoan.update({
      where: { id: loanId },
      data: {},
    });

    await tx.libraryBookCopy.update({
      where: { id: loan.bookCopyId },
      data: { status: 'AVAILABLE' },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'LIBRARY_LOAN_RETURNED',
        entity: 'LibraryLoan',
        entityId: loanId,
        metadata: { bookCopyId: loan.bookCopyId, notes },
        ipAddress,
      },
    });

    return updatedLoan;
  });

  return result;
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