// Quiz service - thin barrel over the quizzes/* modules. Kept as the stable
// entry point for the controller and tests; see REFACTORING_PLAN Stage 3.
export {
  listCourseQuizzes,
  getQuizDetails,
  createQuiz,
  updateQuiz,
  archiveQuiz,
} from './quizzes/quizCrud';

export { addQuestion, updateQuestion, deleteQuestion } from './quizzes/questionService';

export { startAttempt, submitAttempt, getQuizResults, getAttemptDetail } from './quizzes/attemptService';
