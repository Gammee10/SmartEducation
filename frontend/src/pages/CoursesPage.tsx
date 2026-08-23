import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  inputStyles,
  labelStyles,
  LoadingState,
  PageHeader,
} from '../components/ui';
import type { Course } from '../types';

interface CourseForm {
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;
  status: string;
}

const emptyForm: CourseForm = {
  title: '',
  description: '',
  subject: '',
  gradeLevel: '',
  status: 'DRAFT',
};

export default function CoursesPage() {
  const { isTeacher } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/courses', { params: { pageSize: 100 } });
      setCourses(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.post('/courses', form);
      setMessage('Course created successfully');
      setShowCreate(false);
      setForm(emptyForm);
      fetchCourses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Browse the catalog and manage course content."
        actions={
          isTeacher ? (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className={showCreate ? buttonSecondary : buttonPrimary}
            >
              {showCreate ? 'Cancel' : '+ Create Course'}
            </button>
          ) : undefined
        }
      />

      {message && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {showCreate && isTeacher && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-gray-200/80 bg-white p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2">
            <label className={labelStyles}>Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className={labelStyles}>Subject *</label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className={labelStyles}>Grade Level *</label>
            <input
              type="text"
              required
              value={form.gradeLevel}
              onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
              className={inputStyles}
              placeholder="e.g. Grade 9"
            />
          </div>
          <div>
            <label className={labelStyles}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={inputStyles}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelStyles}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className={inputStyles}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className={buttonPrimary}
            >
              {submitting ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingState label="Loading courses…" />
      ) : courses.length === 0 ? (
        <EmptyState
          icon="book"
          title={isTeacher ? 'No courses yet' : 'No courses available'}
          message={
            isTeacher
              ? 'Create your first course to start adding content, assignments, and quizzes.'
              : 'Check back soon — new courses are added regularly.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="group rounded-xl border border-gray-200/80 bg-white p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-base font-semibold text-gray-900 transition-colors duration-150 group-hover:text-primary-700">
                  {course.title}
                </h3>
                <StatusBadge status={course.status} />
              </div>
              <p className="text-sm text-gray-600 mt-1">{course.subject}</p>
              <p className="text-xs text-gray-400 mt-0.5">Grade: {course.gradeLevel}</p>
              {course.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{course.description}</p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                <span className="truncate">{course.teacher?.user?.fullName || 'Unknown teacher'}</span>
                <span className="flex-shrink-0 pl-2">
                  {course._count?.enrollments || 0} students · {course._count?.content || 0} items
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}