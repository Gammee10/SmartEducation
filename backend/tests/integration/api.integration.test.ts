// Integration tests - auth login flow, quiz attempt lifecycle, library
// borrow/approve/return, RBAC 401/403 matrix. Runs against a throwaway
// Postgres; skips entirely when the test database is unavailable.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

import { startTestApp, stopTestApp, isDatabaseAvailable } from './helpers';

let baseUrl: string | null = null;
const api = () => request(baseUrl as string);

const ADMIN = { email: 'admin@test.edu', password: 'AdminPass123!', fullName: 'Test Admin' };
const TEACHER = { email: 'teacher@test.edu', password: 'TeacherPass123!', fullName: 'Test Teacher' };
const STUDENT = { email: 'student@test.edu', password: 'StudentPass123!', fullName: 'Test Student' };

let adminToken = '';
let teacherToken = '';
let studentToken = '';

let courseId = '';
let quizId = '';
let question1 = '';
let option1a = '';
let option1b = '';
let bookId = '';
let copyId = '';
let requestId = '';
let loanId = '';

before(async () => {
  if (!(await isDatabaseAvailable())) return;
  baseUrl = await startTestApp();
  if (!baseUrl) return;

  // The first admin cannot be created via the API (admin-controlled user
  // creation) - seed it directly, then exercise the API for the rest.
  const { default: prisma } = await import('../../src/prisma/client');
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash(ADMIN.password, 4);
  await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: {},
    create: { email: ADMIN.email, fullName: ADMIN.fullName, role: 'ADMIN', passwordHash: hash },
  });

  const adminLogin = await api().post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
  adminToken = adminLogin.body.data.token;
  assert.strictEqual(adminLogin.status, 200, 'admin login should succeed');

  const t = await api()
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: TEACHER.email, fullName: TEACHER.fullName, role: 'TEACHER', password: TEACHER.password, subject: 'Math' });
  assert.strictEqual(t.status, 201, `teacher creation: ${JSON.stringify(t.body)}`);
  const s = await api()
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: STUDENT.email, fullName: STUDENT.fullName, role: 'STUDENT', password: STUDENT.password, gradeLevel: 'Grade 9' });
  assert.strictEqual(s.status, 201, `student creation: ${JSON.stringify(s.body)}`);

  teacherToken = (await api().post('/api/auth/login').send({ email: TEACHER.email, password: TEACHER.password })).body.data.token;
  studentToken = (await api().post('/api/auth/login').send({ email: STUDENT.email, password: STUDENT.password })).body.data.token;
  assert.ok(teacherToken && studentToken, 'teacher and student logins should succeed');
});

after(async () => {
  await stopTestApp();
});

describe('auth flow', () => {
  it('logs in with valid credentials and returns a usable token', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.user.email, STUDENT.email);
    assert.strictEqual(res.body.data.user.passwordHash, undefined);
  });

  it('rejects bad credentials with 401', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().post('/api/auth/login').send({ email: STUDENT.email, password: 'wrong-password' });
    assert.strictEqual(res.status, 401);
  });

  it('changes password: old password stops working, new one works', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api()
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ currentPassword: STUDENT.password, newPassword: 'NewStudentPass123!' });
    assert.strictEqual(res.status, 200);

    const oldLogin = await api().post('/api/auth/login').send({ email: STUDENT.email, password: STUDENT.password });
    assert.strictEqual(oldLogin.status, 401);

    const newLogin = await api().post('/api/auth/login').send({ email: STUDENT.email, password: 'NewStudentPass123!' });
    assert.strictEqual(newLogin.status, 200);
    studentToken = newLogin.body.data.token;
  });

  it('rejects forged alg:none tokens with 401', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ sub: 'anything' }, 'test-secret-for-integration-tests', { algorithm: 'none' as never, expiresIn: '1h' });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    assert.strictEqual(res.status, 401);
  });
});

describe('RBAC 401/403 matrix', () => {
  it('rejects unauthenticated access with 401', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().get('/api/auth/me');
    assert.strictEqual(res.status, 401);
  });

  it('rejects student hitting admin endpoints with 403', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().get('/api/users').set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 403);
  });

  it('rejects teacher hitting admin endpoints with 403', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().get('/api/users').set('Authorization', `Bearer ${teacherToken}`);
    assert.strictEqual(res.status, 403);
  });

  it('allows admin to list users', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.users.length >= 3);
  });
});

describe('quiz attempt lifecycle (start → submit → limit)', () => {
  before(async (t) => {
    if (!baseUrl) return;
    // Teacher creates an ACTIVE course; admin enrolls the student
    const course = await api()
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Integration Math', subject: 'Math', gradeLevel: 'Grade 9', status: 'ACTIVE' });
    assert.strictEqual(course.status, 201, JSON.stringify(course.body));
    courseId = course.body.data.course.id;

    const { default: prisma } = await import('../../src/prisma/client');
    const studentRow = await prisma.student.findFirst();
    const enroll = await api()
      .post(`/api/courses/${courseId}/enroll`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId: studentRow!.id });
    assert.ok([201, 409].includes(enroll.status), JSON.stringify(enroll.body));

    const quiz = await api()
      .post(`/api/courses/${courseId}/quizzes`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Lifecycle Quiz',
        timeLimit: 10,
        maxAttempts: 1,
        status: 'PUBLISHED',
        questions: [
          {
            prompt: 'What is 2+2?',
            type: 'SINGLE_CHOICE',
            points: 2,
            options: [
              { optionText: '3', isCorrect: false },
              { optionText: '4', isCorrect: true },
            ],
          },
        ],
      });
    assert.strictEqual(quiz.status, 201, JSON.stringify(quiz.body));
    quizId = quiz.body.data.quiz.id;
    const question = quiz.body.data.quiz.questions[0];
    question1 = question.id;
    option1a = question.options[0].id;
    option1b = question.options[1].id;
  });

  it('student starts an attempt and receives questions without answer keys', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().post(`/api/quizzes/${quizId}/attempt`).set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    const { attempt, quiz } = res.body.data;
    assert.ok(attempt.id);
    assert.strictEqual(quiz.questions.length, 1);
    for (const option of quiz.questions[0].options) {
      assert.strictEqual(option.isCorrect, undefined, 'answer key must not leak');
    }
  });

  it('restarting returns the SAME attempt (limit not bypassable)', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const first = await api().get(`/api/quizzes/${quizId}`).set('Authorization', `Bearer ${studentToken}`);
    const inProgress = first.body.data.attempts.find((a: any) => a.status === 'IN_PROGRESS');
    assert.ok(inProgress, 'an in-progress attempt should exist');
    const restart = await api().post(`/api/quizzes/${quizId}/attempt`).set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(restart.status, 201);
    assert.strictEqual(restart.body.data.attempt.id, inProgress.id, 'must reuse the in-progress attempt');
  });

  it('student submits and gets graded', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const detail = await api().get(`/api/quizzes/${quizId}`).set('Authorization', `Bearer ${studentToken}`);
    const attemptId = detail.body.data.attempts.find((a: any) => a.status === 'IN_PROGRESS').id;
    const res = await api()
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [{ questionId: question1, optionIds: [option1b] }] });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.data.score, 2);
    assert.strictEqual(res.body.data.status, 'SUBMITTED');
    void option1a;
  });

  it('double submission is rejected with 409', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const detail = await api().get(`/api/quizzes/${quizId}`).set('Authorization', `Bearer ${studentToken}`);
    const attemptId = detail.body.data.attempts[0].id;
    const res = await api()
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [] });
    assert.strictEqual(res.status, 409);
  });

  it('a new start is rejected once maxAttempts is exhausted', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().post(`/api/quizzes/${quizId}/attempt`).set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 409);
  });

  it('teacher sees results with student info', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().get(`/api/quizzes/${quizId}/results`).set('Authorization', `Bearer ${teacherToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.attempts.length >= 1);
    assert.ok(res.body.data.attempts[0].student.user.fullName);
  });

  it('student does NOT receive classmate emails in course details', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api().get(`/api/courses/${courseId}`).set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.course.enrollments, undefined, 'roster must be trimmed for students');
  });
});

describe('library borrow / approve / return', () => {
  before(async (t) => {
    if (!baseUrl) return;
    const book = await api()
      .post('/api/library/books')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test Book', author: 'Author X', copies: '1' });
    assert.strictEqual(book.status, 201, JSON.stringify(book.body));
    bookId = book.body.data.book.id;
    const { default: prisma } = await import('../../src/prisma/client');
    const copy = await prisma.libraryBookCopy.findFirst({ where: { bookId } });
    copyId = copy!.id;
  });

  it('student requests a book copy', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api()
      .post('/api/library/requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ bookCopyId: copyId });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    requestId = res.body.data.request.id;
  });

  it('admin approves; a loan is created and the copy becomes BORROWED', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api()
      .post(`/api/library/requests/${requestId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    loanId = res.body.data.loan.id;

    const { default: prisma } = await import('../../src/prisma/client');
    const copy = await prisma.libraryBookCopy.findUnique({ where: { id: copyId } });
    assert.strictEqual(copy!.status, 'BORROWED');
  });

  it('a second approval of the same request is rejected', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const res = await api()
      .post(`/api/library/requests/${requestId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    assert.strictEqual(res.status, 409);
  });

  it('returning the loan frees the copy; double return is a 409', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const ret = await api().post(`/api/library/loans/${loanId}/return`).set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(ret.status, 200, JSON.stringify(ret.body));

    const { default: prisma } = await import('../../src/prisma/client');
    const copy = await prisma.libraryBookCopy.findUnique({ where: { id: copyId } });
    assert.strictEqual(copy!.status, 'AVAILABLE');

    const again = await api().post(`/api/library/loans/${loanId}/return`).set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(again.status, 409);
  });

  it('pagination bounds: pageSize=999999 is clamped, page=abc is safe', async (t) => {
    if (!baseUrl) return t.skip('test database not available');
    const huge = await api()
      .get('/api/library/books?page=1&pageSize=999999')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(huge.status, 200);
    assert.ok(huge.body.pagination.pageSize <= 100, 'pageSize must be clamped');

    const garbage = await api()
      .get('/api/library/books?page=abc&pageSize=xyz')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(garbage.status, 200, 'invalid pagination must not 500');
    assert.ok(garbage.body.pagination.page >= 1);
  });
});
