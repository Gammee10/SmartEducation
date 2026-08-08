// Library routes - books, borrow requests, loans.
import { Router } from 'express';
import * as libraryController from '../controllers/libraryController';
import authenticate from '../middleware/auth';
import { requireAdmin, requireStudent } from '../middleware/rbac';

const router = Router();

// All library routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------
// Books (catalog - all authenticated users can view)
// ---------------------------------------------------------------
router.get('/books', libraryController.listBooks);
router.get('/books/:id', libraryController.getBook);

// Book management - Admin only
router.post('/books', requireAdmin, libraryController.createBook);
router.put('/books/:id', requireAdmin, libraryController.updateBook);
router.post('/books/:id/copies', requireAdmin, libraryController.addCopies);

// ---------------------------------------------------------------
// Borrow Requests
// ---------------------------------------------------------------
router.post('/requests', requireStudent, libraryController.createBorrowRequest);
router.get('/requests/mine', requireStudent, libraryController.listMyBorrowRequests);
router.get('/requests', requireAdmin, libraryController.listBorrowRequests);
router.post('/requests/:id/decide', requireAdmin, libraryController.decideBorrowRequest);

// ---------------------------------------------------------------
// Loans
// ---------------------------------------------------------------
router.get('/loans/mine', requireStudent, libraryController.listMyLoans);
router.get('/loans', requireAdmin, libraryController.listLoans);
router.post('/loans/:id/return', requireAdmin, libraryController.returnLoan);

export default router;