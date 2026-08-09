import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      DRAFT: 'bg-yellow-50 text-yellow-700',
      ARCHIVED: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-block text-xs font-medium rounded-full px-2 py-1 ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
        {isTeacher && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            {showCreate ? 'Cancel' : '+ Create Course'}
          </button>
        )}
      </div>

      {message && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {showCreate && isTeacher && (
        <form onSubmit={handleCreate} className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subject *</label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Grade Level *</label>
            <input
              type="text"
              required
              value={form.gradeLevel}
              onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
              placeholder="e.g. Grade 9"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading courses...</div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {isTeacher ? 'You have not created any courses yet.' : 'No courses available.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                {statusBadge(course.status)}
              </div>
              <p className="text-sm text-gray-600 mt-1">{course.subject}</p>
              <p className="text-xs text-gray-400 mt-1">Grade: {course.gradeLevel}</p>
              {course.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{course.description}</p>
              )}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>{course.teacher?.user?.fullName || 'Unknown teacher'}</span>
                <span>
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