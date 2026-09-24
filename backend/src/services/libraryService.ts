// Library service - thin barrel over library/catalogService and
// library/borrowingService. Kept as the stable entry point for the
// controller and tests; see REFACTORING_PLAN Stage 3.
export {
  listBooks,
  getBook,
  createBook,
  updateBook,
  addCopies,
} from './library/catalogService';

export {
  createBorrowRequest,
  listBorrowRequests,
  listMyBorrowRequests,
  decideBorrowRequest,
  listLoans,
  listMyLoans,
  returnLoan,
} from './library/borrowingService';
