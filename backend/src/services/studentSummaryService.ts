// Student summary service - academic profile for a student.
import prisma from '../prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export async function getStudentSummary(opts: { studentId: string; role: string; userId: string }): Promise<any> {
  const { studentId, role, userId } = opts;
  // Privacy: teachers share one course with the student - they get the name,
  // not contact details. Students only access their own summary; admins see all.
  const userSelect =
    role === 'TEACHER'
      ? { id: true, fullName: true }
      : { id: true, fullName: true, email: true, phone: true };
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: userSelect } },
  });
  if (!student) throw new NotFoundError('Student not found');

  // Access control
  if (role === 'STUDENT') {
    if (student.userId !== userId) throw new ForbiddenError('You can only view your own profile');
  } else if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundError('Teacher profile not found');
    const teachingCourses = await prisma.course.findMany({ where: { teacherId: teacher.id }, select: { id: true } });
    if (teachingCourses.length === 0) throw new ForbiddenError('You do not have access to this student');
    const shared = await prisma.courseEnrollment.findFirst({
      where: { studentId, courseId: { in: teachingCourses.map((c: any) => c.id) } },
      select: { id: true },
    });
    if (!shared) throw new ForbiddenError('You do not teach this student');
  }

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentId, status: 'ACTIVE' },
    include: { course: { select: { id: true, title: true, subject: true, gradeLevel: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const [attendanceCount, presentCount, gradedSubs, attempts] = await Promise.all([
    prisma.attendance.count({ where: { studentId } }),
    prisma.attendance.count({ where: { studentId, status: { in: ['PRESENT', 'LATE'] } } }),
    prisma.assignmentSubmission.findMany({
      where: { studentId, status: 'GRADED', score: { not: null } },
      select: { score: true },
    }),
    prisma.quizAttempt.findMany({
      where: { studentId, status: 'SUBMITTED', score: { not: null } },
      select: { score: true, maxScore: true },
    }),
  ]);

  const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;
  const avgAssignmentScore = gradedSubs.length > 0
    ? Math.round((gradedSubs.reduce((s: number, x: any) => s + (x.score || 0), 0) / gradedSubs.length) * 100) / 100
    : 0;
  const quizPct = attempts.filter((a: any) => a.maxScore && a.maxScore > 0).map((a: any) => (a.score || 0) / a.maxScore);
  const avgQuizScore = quizPct.length > 0
    ? Math.round((quizPct.reduce((s: number, p: number) => s + p, 0) / quizPct.length) * 10000) / 100
    : 0;

  const recentAttempts = await prisma.quizAttempt.findMany({
    where: { studentId, status: 'SUBMITTED' },
    include: { quiz: { select: { id: true, title: true } } },
    orderBy: { submittedAt: 'desc' },
    take: 5,
  });

  return {
    student: {
      id: student.id,
      studentCode: student.studentCode,
      gradeLevel: student.gradeLevel,
      section: student.section,
      user: student.user,
    },
    stats: {
      enrollments: enrollments.length,
      attendanceRate,
      avgAssignmentScore,
      avgQuizScore,
    },
    courses: enrollments.map((e: any) => e.course),
    recentAttempts,
  };
}
