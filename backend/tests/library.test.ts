// Tests for the library service - catalog, requests, approvals, loans, returns.
import { test } from 'node:test';
import assert from 'node:assert';

// ---------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------
const mockBook: any = {
  id: 'book-1',
  title: 'Mathematics Grade 9',
  author: 'Ministry of Education',
  isbn: '978-0001',
  category: 'Textbook',
  copies: [
    { id: 'copy-1', copyNumber: '1', status: 'AVAILABLE', location: 'Shelf A' },
    { id: 'copy-2', copyNumber: '2', status: 'BORROWED', location: 'Shelf A' },
  ],
};

const mockCopy: any = {
  id: 'copy-1',
  bookId: 'book-1',
  copyNumber: '1',
  status: 'AVAILABLE',
  book: mockBook,
};

const mockRequest: any = {
  id: 'req-1',
  studentId: 'student-1',
  bookCopyId: 'copy-1',
  status: 'PENDING',
  requestedAt: new Date(),
  bookCopy: mockCopy,
};

const mockLoan: any = {
  id: 'loan-1',
  borrowReqId: 'req-1',
  studentId: 'student-1',
  bookCopyId: 'copy-1',
  status: 'ACTIVE',
  issuedAt: new Date(),
  dueDate: new Date(),
  bookCopy: mockCopy,
};

// ---------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------
const state: any = {
  books: [mockBook],
  copies: [mockCopy, { ...mockCopy, id: 'copy-2', copyNumber: '2', status: 'BORROWED' }],
  requests: [mockRequest],
  loans: [mockLoan],
  auditLogs: [],
};

const mockPrisma = {
  libraryBook: {
    findMany: async ({ where, skip, take }: any) => {
      let result = state.books;
      if (where?.OR) {
        result = result.filter((b: any) =>
          where.OR.some((cond: any) => {
            const field = Object.keys(cond)[0];
            const value = cond[field].contains;
            return String(b[field]).toLowerCase().includes(value.toLowerCase());
          })
        );
      }
      if (where?.category) {
        result = result.filter((b: any) => b.category === where.category);
      }
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.books;
      if (where?.OR) {
        result = result.filter((b: any) =>
          where.OR.some((cond: any) => {
            const field = Object.keys(cond)[0];
            const value = cond[field].contains;
            return String(b[field]).toLowerCase().includes(value.toLowerCase());
          })
        );
      }
      return result.length;
    },
    findUnique: async ({ where }: any) => state.books.find((b: any) => b.id === where.id) || null,
    create: async ({ data }: any) => {
      const book = {
        id: `book-${state.books.length + 1}`,
        ...data,
        copies: data.copies?.create || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.books.push(book);
      return book;
    },
    update: async ({ where, data }: any) => {
      const idx = state.books.findIndex((b: any) => b.id === where.id);
      state.books[idx] = { ...state.books[idx], ...data };
      return state.books[idx];
    },
  },
  libraryBookCopy: {
    findUnique: async ({ where }: any) => state.copies.find((c: any) => c.id === where.id) || null,
    findMany: async ({ where }: any) => state.copies.filter((c: any) => c.bookId === where.bookId),
    createMany: async ({ data }: any) => {
      state.copies.push(...data.map((d: any) => ({ id: `copy-${state.copies.length + 1}`, ...d })));
      return { count: data.length };
    },
    update: async ({ where, data }: any) => {
      const idx = state.copies.findIndex((c: any) => c.id === where.id);
      state.copies[idx] = { ...state.copies[idx], ...data };
      return state.copies[idx];
    },
    updateMany: async ({ where, data }: any) => {
      const matches = state.copies.filter(
        (c: any) => (!where.id || c.id === where.id) && (!where.status || c.status === where.status)
      );
      for (const c of matches) Object.assign(c, data);
      return { count: matches.length };
    },
  },
  libraryBorrowRequest: {
    create: async ({ data }: any) => {
      const req = {
        id: `req-${state.requests.length + 1}`,
        ...data,
        status: 'PENDING',
        requestedAt: new Date(),
        bookCopy: mockCopy,
      };
      state.requests.push(req);
      return req;
    },
    findFirst: async ({ where }: any) =>
      state.requests.find(
        (r: any) => r.studentId === where.studentId && r.bookCopyId === where.bookCopyId && r.status === where.status
      ) || null,
    findUnique: async ({ where }: any) => state.requests.find((r: any) => r.id === where.id) || null,
    findMany: async ({ where, skip, take }: any) => {
      let result = state.requests;
      if (where?.status) result = result.filter((r: any) => r.status === where.status);
      if (where?.studentId) result = result.filter((r: any) => r.studentId === where.studentId);
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.requests;
      if (where?.status) result = result.filter((r: any) => r.status === where.status);
      if (where?.studentId) result = result.filter((r: any) => r.studentId === where.studentId);
      return result.length;
    },
    update: async ({ where, data }: any) => {
      const idx = state.requests.findIndex((r: any) => r.id === where.id);
      state.requests[idx] = { ...state.requests[idx], ...data };
      return state.requests[idx];
    },
  },
  libraryLoan: {
    create: async ({ data }: any) => {
      const loan = {
        id: `loan-${state.loans.length + 1}`,
        ...data,
        status: 'ACTIVE',
        bookCopy: mockCopy,
      };
      state.loans.push(loan);
      return loan;
    },
    findUnique: async ({ where }: any) => state.loans.find((l: any) => l.id === where.id) || null,
    findMany: async ({ where, skip, take }: any) => {
      let result = state.loans;
      if (where?.status) result = result.filter((l: any) => l.status === where.status);
      if (where?.studentId) result = result.filter((l: any) => l.studentId === where.studentId);
      if (where?.dueDate?.lt) result = result.filter((l: any) => new Date(l.dueDate) < where.dueDate.lt);
      return result.slice(skip || 0, (skip || 0) + (take || 20));
    },
    count: async ({ where }: any) => {
      let result = state.loans;
      if (where?.status) result = result.filter((l: any) => l.status === where.status);
      if (where?.studentId) result = result.filter((l: any) => l.studentId === where.studentId);
      if (where?.dueDate?.lt) result = result.filter((l: any) => new Date(l.dueDate) < where.dueDate.lt);
      return result.length;
    },
    update: async ({ where, data }: any) => {
      const idx = state.loans.findIndex((l: any) => l.id === where.id);
      state.loans[idx] = { ...state.loans[idx], ...data };
      return state.loans[idx];
    },
    updateMany: async ({ where, data }: any) => {
      const matches = state.loans.filter(
        (l: any) =>
          (!where.id || l.id === where.id) &&
          (!where.status?.not || l.status !== where.status.not) &&
          (!where.status || where.status.not || l.status === where.status)
      );
      for (const l of matches) Object.assign(l, data);
      return { count: matches.length };
    },
  },
  auditLog: {
    create: async ({ data }: any) => {
      const log = { id: `audit-${state.auditLogs.length + 1}`, ...data };
      state.auditLogs.push(log);
      return log;
    },
  },
  $transaction: async (fn: any) => fn(mockPrisma),
};

// Inject mock prisma
const prismaClientPath = require.resolve('../src/prisma/client');
require.cache[prismaClientPath] = {
  id: prismaClientPath,
  filename: prismaClientPath,
  loaded: true,
  exports: mockPrisma,
} as any;

const libraryService = require('../src/services/libraryService');
const { NotFoundError, ConflictError, ValidationError } = require('../src/utils/errors');

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

test('listBooks returns all books with pagination', async () => {
  const result = await libraryService.listBooks({ page: 1, pageSize: 20 });
  assert.strictEqual(result.books.length, 1);
  assert.strictEqual(result.pagination.total, 1);
  assert.strictEqual(result.books[0].title, 'Mathematics Grade 9');
});

test('listBooks searches by title', async () => {
  const result = await libraryService.listBooks({ search: 'mathematics', page: 1, pageSize: 20 });
  assert.strictEqual(result.books.length, 1);
  assert.strictEqual(result.pagination.total, 1);
});

test('listBooks returns empty for no match', async () => {
  const result = await libraryService.listBooks({ search: 'nonexistent', page: 1, pageSize: 20 });
  assert.strictEqual(result.books.length, 0);
});

test('getBook returns book with copies', async () => {
  const book = await libraryService.getBook('book-1');
  assert.strictEqual(book.id, 'book-1');
  assert.strictEqual(book.copies.length, 2);
});

test('getBook throws NotFoundError for missing book', async () => {
  await assert.rejects(
    () => libraryService.getBook('missing'),
    (err: any) => err instanceof NotFoundError
  );
});

test('createBook validates title and author', async () => {
  await assert.rejects(
    () => libraryService.createBook({ actorId: 'admin-1', data: { title: '', author: '' } }),
    (err: any) => err instanceof ValidationError
  );
});

test('createBook creates book with copies and audit log', async () => {
  const book = await libraryService.createBook({
    actorId: 'admin-1',
    data: { title: 'Physics Grade 9', author: 'Ministry', copies: '2' },
  });
  assert.strictEqual(book.title, 'Physics Grade 9');
  assert.strictEqual(state.auditLogs.length, 1);
  assert.strictEqual(state.auditLogs[0].action, 'LIBRARY_BOOK_CREATED');
});

test('createBorrowRequest rejects unavailable copy', async () => {
  await assert.rejects(
    () => libraryService.createBorrowRequest({ studentId: 'student-1', bookCopyId: 'copy-2' }),
    (err: any) => err instanceof ConflictError
  );
});

test('createBorrowRequest creates request and audit log', async () => {
  // Cancel the pre-existing pending request first
  const existingIdx = state.requests.findIndex((r: any) => r.id === 'req-1');
  state.requests[existingIdx] = { ...state.requests[existingIdx], status: 'CANCELLED' };

  const req = await libraryService.createBorrowRequest({
    studentId: 'student-1',
    bookCopyId: 'copy-1',
    reason: 'Need for class',
  });
  assert.strictEqual(req.status, 'PENDING');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'LIBRARY_BORROW_REQUESTED'), true);
});

test('createBorrowRequest rejects duplicate pending request', async () => {
  await assert.rejects(
    () => libraryService.createBorrowRequest({ studentId: 'student-1', bookCopyId: 'copy-1' }),
    (err: any) => err instanceof ConflictError
  );
});

test('listMyBorrowRequests filters by student', async () => {
  const result = await libraryService.listMyBorrowRequests({ studentId: 'student-1' });
  assert.strictEqual(result.requests.length >= 1, true);
});

test('decideBorrowRequest requires due date for approval', async () => {
  // Use the existing pending request (req-2 created earlier)
  const pendingReq = state.requests.find((r: any) => r.status === 'PENDING');
  assert.ok(pendingReq, 'Expected a pending request to exist');

  await assert.rejects(
    () => libraryService.decideBorrowRequest({ actorId: 'admin-1', requestId: pendingReq.id, decision: 'APPROVED' }),
    (err: any) => err instanceof ValidationError
  );
});

test('decideBorrowRequest approves and creates loan in transaction', async () => {
  // Find the fresh pending request created in the previous test
  const pendingReq = state.requests.find((r: any) => r.status === 'PENDING');
  assert.ok(pendingReq, 'Expected a pending request to exist');

  const result = await libraryService.decideBorrowRequest({
    actorId: 'admin-1',
    requestId: pendingReq.id,
    decision: 'APPROVED',
    dueDate: '2026-09-01',
  });
  assert.strictEqual(result.request.status, 'APPROVED');
  assert.ok(result.loan);
  assert.strictEqual(result.loan.status, 'ACTIVE');
  // Copy should be marked borrowed
  const copy = state.copies.find((c: any) => c.id === 'copy-1');
  assert.strictEqual(copy.status, 'BORROWED');
  // Audit log created
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'LIBRARY_BORROW_APPROVED'), true);
});

test('decideBorrowRequest rejects approving a second request for the same copy (race guard)', async () => {
  // copy-1 is BORROWED after the previous approval; simulate a second pending
  // request that raced in before the copy was flipped - approval must fail
  // atomically and leave the request untouched.
  state.requests.push({
    id: 'req-race',
    studentId: 'student-2',
    bookCopyId: 'copy-1',
    status: 'PENDING',
    requestedAt: new Date(),
    bookCopy: mockCopy,
  });
  const loansBefore = state.loans.length;
  const auditsBefore = state.auditLogs.length;

  await assert.rejects(
    () =>
      libraryService.decideBorrowRequest({
        actorId: 'admin-1',
        requestId: 'req-race',
        decision: 'APPROVED',
        dueDate: '2026-09-01',
      }),
    (err: any) => err instanceof ConflictError
  );

  assert.strictEqual(state.requests.find((r: any) => r.id === 'req-race').status, 'PENDING');
  assert.strictEqual(state.loans.length, loansBefore, 'no loan may be created for a lost race');
  assert.strictEqual(state.auditLogs.length, auditsBefore, 'no approval audit may be written for a lost race');
});

test('decideBorrowRequest rejects already decided request', async () => {
  // Use the request that was just approved
  const approvedReq = state.requests.find((r: any) => r.status === 'APPROVED');
  assert.ok(approvedReq, 'Expected an approved request to exist');

  await assert.rejects(
    () => libraryService.decideBorrowRequest({ actorId: 'admin-1', requestId: approvedReq.id, decision: 'REJECTED' }),
    (err: any) => err instanceof ConflictError
  );
});

test('decideBorrowRequest rejects with audit log', async () => {
  // Reset copy-1 to available and create a fresh pending request
  const copyIdx = state.copies.findIndex((c: any) => c.id === 'copy-1');
  state.copies[copyIdx] = { ...state.copies[copyIdx], status: 'AVAILABLE' };

  const req = await libraryService.createBorrowRequest({
    studentId: 'student-1',
    bookCopyId: 'copy-1',
  });
  const result = await libraryService.decideBorrowRequest({
    actorId: 'admin-1',
    requestId: req.id,
    decision: 'REJECTED',
    reason: 'Not available',
  });
  assert.strictEqual(result.request.status, 'REJECTED');
  assert.strictEqual(result.loan, null);
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'LIBRARY_BORROW_REJECTED'), true);
});

test('listLoans returns loans', async () => {
  const result = await libraryService.listLoans({});
  assert.strictEqual(result.loans.length >= 1, true);
});

test('listLoans annotates past-due ACTIVE loans as OVERDUE', async () => {
  state.loans.push({
    id: 'loan-overdue',
    studentId: 'student-1',
    bookCopyId: 'copy-2',
    status: 'ACTIVE',
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    issuedAt: new Date(),
  });
  state.loans.push({
    id: 'loan-future',
    studentId: 'student-1',
    bookCopyId: 'copy-2',
    status: 'ACTIVE',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    issuedAt: new Date(),
  });

  const result = await libraryService.listLoans({});
  const overdue = result.loans.find((l: any) => l.id === 'loan-overdue');
  const future = result.loans.find((l: any) => l.id === 'loan-future');
  assert.strictEqual(overdue.status, 'OVERDUE', 'past-due ACTIVE loan must be flagged OVERDUE');
  assert.strictEqual(future.status, 'ACTIVE', 'future-due loan stays ACTIVE');
});

test('listLoans status=OVERDUE filter returns only past-due loans', async () => {
  const result = await libraryService.listLoans({ status: 'OVERDUE' });
  assert.ok(result.loans.length >= 1);
  assert.ok(
    result.loans.every(
      (l: any) => l.status === 'OVERDUE' && new Date(l.dueDate).getTime() < Date.now()
    ),
    'every returned loan must be overdue'
  );
});

test('listMyLoans filters by student', async () => {
  const result = await libraryService.listMyLoans({ studentId: 'student-1' });
  assert.strictEqual(result.loans.length >= 1, true);
});

test('returnLoan updates loan and copy status with audit', async () => {
  const loan = await libraryService.returnLoan({
    actorId: 'admin-1',
    loanId: 'loan-1',
    notes: 'Good condition',
  });
  assert.strictEqual(loan.status, 'RETURNED');
  assert.ok(loan.returnedAt);
  const copy = state.copies.find((c: any) => c.id === 'copy-1');
  assert.strictEqual(copy.status, 'AVAILABLE');
  assert.strictEqual(state.auditLogs.some((l: any) => l.action === 'LIBRARY_LOAN_RETURNED'), true);
});

test('returnLoan rejects already returned loan', async () => {
  await assert.rejects(
    () => libraryService.returnLoan({ actorId: 'admin-1', loanId: 'loan-1' }),
    (err: any) => err instanceof ConflictError
  );
});

test('returnLoan throws NotFoundError for missing loan', async () => {
  await assert.rejects(
    () => libraryService.returnLoan({ actorId: 'admin-1', loanId: 'missing' }),
    (err: any) => err instanceof NotFoundError
  );
});