// Seed script - creates initial admin, teacher, and student users.
// Uses DIRECT_URL (session pooler) to avoid pgbouncer prepared statement issues.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL,
    },
  },
});

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.edu' },
    update: {},
    create: {
      email: 'admin@school.edu',
      passwordHash,
      fullName: 'System Administrator',
      role: 'ADMIN',
    },
  });
  console.log('Admin created:', admin.email);

  // Teacher
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@school.edu' },
    update: {},
    create: {
      email: 'teacher@school.edu',
      passwordHash,
      fullName: 'Sample Teacher',
      role: 'TEACHER',
      teacher: {
        create: {
          employeeCode: 'TCH-001',
          subject: 'Mathematics',
        },
      },
    },
    include: { teacher: true },
  });
  console.log('Teacher created:', teacherUser.email);

  // Student
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@school.edu' },
    update: {},
    create: {
      email: 'student@school.edu',
      passwordHash,
      fullName: 'Sample Student',
      role: 'STUDENT',
      student: {
        create: {
          studentCode: 'STU-001',
          gradeLevel: 'Grade 9',
          section: 'A',
        },
      },
    },
    include: { student: true },
  });
  console.log('Student created:', studentUser.email);

  // Sample library books
  const sampleBooks = [
    { title: 'Mathematics Grade 9', author: 'Ministry of Education', category: 'Textbook', copies: 3 },
    { title: 'English for Ethiopia', author: 'Ministry of Education', category: 'Textbook', copies: 2 },
    { title: 'Physics Grade 9', author: 'Ministry of Education', category: 'Textbook', copies: 2 },
    { title: 'Chemistry Grade 9', author: 'Ministry of Education', category: 'Textbook', copies: 2 },
    { title: 'Biology Grade 9', author: 'Ministry of Education', category: 'Textbook', copies: 2 },
  ];

  for (const book of sampleBooks) {
    const existing = await prisma.libraryBook.findFirst({
      where: { title: book.title, author: book.author },
    });
    if (!existing) {
      await prisma.libraryBook.create({
        data: {
          title: book.title,
          author: book.author,
          category: book.category,
          createdById: admin.id,
          copies: {
            create: Array.from({ length: book.copies }, (_, i) => ({
              copyNumber: String(i + 1),
              createdById: admin.id,
            })),
          },
        },
      });
      console.log('Book created:', book.title);
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });