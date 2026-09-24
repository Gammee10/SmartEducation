// Library catalog - books, copies, and search. Split out of
// libraryService (REFACTORING_PLAN Stage 3) so catalog reads/writes and
// borrowing have one reason to change each.
import { Prisma } from '@prisma/client';
import prisma from '../../prisma/client';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { assertOptionalHttpUrl } from '../../utils/url';
import { writeAuditLog } from '../auditService';

interface ListBooksParams {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  // M4: bound the per-book copies preview (default 10). The catalog badge
  // uses the server-computed availableCopies; full copy detail stays on
  // getBook. Pass a larger value only where the full list is truly needed.
  copiesPreview?: number;
}

const MAX_COPIES_PREVIEW = 50;

async function listBooks({ search, category, page = 1, pageSize = 20, copiesPreview = 10 }: ListBooksParams) {
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
        // M4: bounded preview - 100 books x 500 copies used to fan out to
        // ~50k rows per page. Counts below keep badges accurate.
        // AVAILABLE-first ordering guarantees the preview contains a
        // requestable copy whenever one exists (the catalog borrows
        // avail[0]).
        copies: {
          select: { id: true, copyNumber: true, status: true, location: true },
          orderBy: [{ status: 'asc' }, { copyNumber: 'asc' }],
          take: Math.min(MAX_COPIES_PREVIEW, Math.max(0, copiesPreview)),
        },
        _count: { select: { copies: true } },
      },
      orderBy: { title: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.libraryBook.count({ where }),
  ]);

  // One grouped query for availability badges (no N+1 per book).
  const ids = books.map((b: any) => b.id);
  const availability =
    ids.length > 0
      ? await prisma.libraryBookCopy.groupBy({
          by: ['bookId'],
          where: { bookId: { in: ids }, status: 'AVAILABLE' },
          _count: { _all: true },
        })
      : [];
  const availableByBook = new Map((availability as any[]).map((row) => [row.bookId, row._count._all]));

  return {
    books: books.map((b: any) => ({
      ...b,
      totalCopies: b._count?.copies ?? b.copies?.length ?? 0,
      availableCopies: availableByBook.get(b.id) ?? 0,
    })),
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

// M3: empty/whitespace-only strings carry no information - store NULL so
// unique-null semantics hold (two "" ISBNs would otherwise collide).
function emptyToNull(value: string | undefined): string | null {
  return value !== undefined && value.trim() !== '' ? value : null;
}

async function updateBook({ actorId, bookId, data, ipAddress }: UpdateBookParams) {
  const existing = await prisma.libraryBook.findUnique({ where: { id: bookId } });
  if (!existing) throw new NotFoundError('Book not found');

  const book = await prisma.libraryBook.update({
    where: { id: bookId },
    data: {
      title: data.title ?? existing.title,
      author: data.author ?? existing.author,
      // M3: normalize empty strings to NULL like createBook does (`isbn ||
      // null`). Unique-null semantics allow many NULLs but a second ""
      // would trip P2002 - and "" is never a real ISBN/publisher.
      isbn: data.isbn !== undefined ? emptyToNull(data.isbn) : existing.isbn,
      publisher: data.publisher !== undefined ? emptyToNull(data.publisher) : existing.publisher,
      publishedYear: data.publishedYear !== undefined ? parseInt(String(data.publishedYear), 10) : existing.publishedYear,
      category: data.category !== undefined ? emptyToNull(data.category) : existing.category,
      description: data.description !== undefined ? emptyToNull(data.description) : existing.description,
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

export { listBooks, getBook, createBook, updateBook, addCopies };
