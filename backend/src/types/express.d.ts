// Express Request type augmentation for authenticated users.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: string;
        status: string;
        student?: { id: string; studentCode: string; gradeLevel: string; section: string | null } | null;
        teacher?: { id: string; employeeCode: string; subject: string | null } | null;
      };
    }
  }
}

export {};