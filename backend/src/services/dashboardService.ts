// Dashboard service - aggregate stats for admin, teacher, and student.
import prisma from '../prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';

function round2(value: number | null | undefined): number {
  return value ? Math.round(value * 100) / 100 : 0;
}

export async function getAdminDashboard(opts: { userId: string }): Promise<any> {
  const { userId } = opts;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'ADMIN') throw new ForbiddenError('Admin access required');

  const [courseCount, studentCount, teacherCount, attendanceCount, assignmentCount, quizCount] = await Promise.all([
    prisma.course.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.attendance.count(),
    prisma.assignment.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.quiz.count({ where: { status: { not: 'ARCHIVED' } } }),
  ]);

  const presentCount = await prisma.attendance.count({ where: { status: { in: ['PRESENT', 'LATE'] } } });
  const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;

  // SQL-level aggregation - no longer loads entire tables into memory
  const [subAgg, quizAgg] = await Promise.all([
    prisma.assignmentSubmission.aggregate({
      where: { status: 'GRADED', score: { not: null } },
      _avg: { score: true },
    }),
    prisma.quizAttempt.aggregate({
      where: { status: 'SUBMITTED', score: { not: null }, maxScore: { gt: 0 } },
      _avg: { score: true },
      _sum: { score: true, maxScore: true },
      _count: true,
    }),
  ]);
  const avgAssignmentScore = round2(subAgg._avg.score);

  // Quiz average: SUM(score)/SUM(maxScore) over submitted attempts - a
  // weighted aggregate that no longer scans rows into memory. Slightly
  // different from a mean of per-attempt percentages (larger quizzes now
  // weigh more); chosen deliberately for SQL-level computation.
  const avgQuizScore =
    quizAgg._count > 0 && (quizAgg._sum.maxScore ?? 0) > 0
      ? Math.round(((quizAgg._sum.score ?? 0) / (quizAgg._sum.maxScore ?? 1)) * 10000) / 100
      : 0;

  return {
    stats: {
      courses: courseCount,
      students: studentCount,
      teachers: teacherCount,
      attendanceRate,
      avgAssignmentScore,
      avgQuizScore,
    },
  };
}
export async function getTeacherDashboard(opts: { userId: string }): Promise<any> {
  const { userId } = opts;
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new NotFoundError('Teacher profile not found');

  const courses = await prisma.course.findMany({
    where: { teacherId: teacher.id, status: { not: 'ARCHIVED' } },
    include: { _count: { select: { enrollments: true, assignments: true, quizzes: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const courseIds = courses.map((c: any) => c.id);

  const [studentCount, recentSubmissions, recentGrades, quizCount] = await Promise.all([
    prisma.courseEnrollment.count({ where: { courseId: { in: courseIds }, status: 'ACTIVE' } }),
    prisma.assignmentSubmission.findMany({
      where: { assignment: { courseId: { in: courseIds } } },
      include: { student: { include: { user: { select: { id: true, fullName: true } } } }, assignment: { select: { id: true, title: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
    }),
    prisma.assignmentSubmission.findMany({
      where: { status: 'GRADED', assignment: { courseId: { in: courseIds } } },
      include: { student: { include: { user: { select: { id: true, fullName: true } } } }, assignment: { select: { id: true, title: true } } },
      orderBy: { gradedAt: 'desc' },
      take: 5,
    }),
    prisma.quiz.count({ where: { courseId: { in: courseIds }, status: { not: 'ARCHIVED' } } }),
  ]);

  return {
    stats: {
      courses: courses.length,
      students: studentCount,
      quizzes: quizCount,
    },
    courses: courses.map((c: any) => ({
      id: c.id,
      title: c.title,
      subject: c.subject,
      gradeLevel: c.gradeLevel,
      status: c.status,
      enrollments: c._count.enrollments,
      assignments: c._count.assignments,
      quizzes: c._count.quizzes,
    })),
    recentSubmissions,
    recentGrades,
  };
}
export async function getStudentDashboard(opts: { userId: string }): Promise<any> {
  const { userId } = opts;
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new NotFoundError('Student profile not found');

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentId: student.id, status: 'ACTIVE' },
    include: { course: { select: { id: true, title: true, subject: true, gradeLevel: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const courseIds = enrollments.map((e: any) => e.courseId);

  const [attendanceCount, presentCount] = await Promise.all([
    prisma.attendance.count({ where: { studentId: student.id } }),
    prisma.attendance.count({ where: { studentId: student.id, status: { in: ['PRESENT', 'LATE'] } } }),
  ]);
  const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;

  const gradedSubs = await prisma.assignmentSubmission.findMany({
    where: { studentId: student.id, status: 'GRADED', score: { not: null } },
    select: { score: true },
  });
  const avgAssignmentScore = gradedSubs.length > 0
    ? Math.round((gradedSubs.reduce((s: number, x: any) => s + (x.score || 0), 0) / gradedSubs.length) * 100) / 100
    : 0;

  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId: student.id, status: 'SUBMITTED', score: { not: null } },
    select: { score: true, maxScore: true },
  });
  const quizPct = attempts.filter((a: any) => a.maxScore && a.maxScore > 0).map((a: any) => (a.score || 0) / a.maxScore);
  const avgQuizScore = quizPct.length > 0
    ? Math.round((quizPct.reduce((s: number, p: number) => s + p, 0) / quizPct.length) * 10000) / 100
    : 0;

  return {
    stats: {
      enrollments: enrollments.length,
      attendanceRate,
      avgAssignmentScore,
      avgQuizScore,
    },
    courses: enrollments.map((e: any) => e.course),
  };
}
