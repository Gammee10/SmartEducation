// Assignment service - thin barrel over the assignments/* modules. Kept as
// the stable entry point for the controller and tests; see
// REFACTORING_PLAN Stage 3.
export {
  listCourseAssignments,
  getAssignmentDetails,
  createAssignment,
  updateAssignment,
  archiveAssignment,
} from './assignments/assignmentCrud';

export { submitAssignment, listSubmissions } from './assignments/submissionService';

export { gradeSubmission } from './assignments/gradingService';
