// Course service - thin barrel over the courses/* modules. Kept as the
// stable entry point for the controller and tests; see REFACTORING_PLAN
// Stage 3.
export { listCourses, getCourse, createCourse, updateCourse } from './courses/courseCrud';

export { enrollStudent, unenrollStudent } from './courses/enrollmentService';

export { listContent, uploadContent, archiveContent } from './courses/contentService';
