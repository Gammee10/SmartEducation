import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Course, ContentItem } from '../types';

interface ContentForm {
  title: string;
  description: string;
  url: string;
  type: string;
}

const emptyForm: ContentForm = {
  title: '',
  description: '',
  url: '',
  type: 'OTHER',
};

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isTeacher, isAdmin } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState<ContentForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [courseRes, contentRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get(`/courses/${id}/content`, { params: { pageSize: 100 } }),
      ]);
      setCourse(courseRes.data.data.course);
      setContent(contentRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/courses/${id}/content`, form);
      setMessage('Content uploaded successfully');
      setShowUpload(false);
      setForm(emptyForm);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload content');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (contentId: string) => {
    setArchiving(contentId);
    setError('');
    setMessage('');
    try {
      await api.post(`/courses/content/${contentId}/archive`);
      setMessage('Content archived');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to archive content');
    } finally {
      setArchiving(null);
    }
  };

  const typeBadge = (type: string) => {
    const styles: Record<string, string> = {
      VIDEO: 'bg-purple-50 text-purple-700',
      DOCUMENT: 'bg-blue-50 text-blue-700',
      PDF: 'bg-red-50 text-red-700',
      IMAGE: 'bg-green-50 text-green-700',
      LINK: 'bg-yellow-50 text-yellow-700',
      OTHER: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-block text-xs font-medium rounded-full px-2 py-1 ${styles[type] || 'bg-gray-100 text-gray-600'}`}>
        {type}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error || 'Course not found'}</p>
        <Link to="/courses" className="text-primary-600 hover:text-primary-700">← Back to Courses</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/courses" className="text-sm text-primary-600 hover:text-primary-700">← Back to Courses</Link>
        <div className="mt-2 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {course.subject} · Grade {course.gradeLevel}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Teacher: {course.teacher?.user?.fullName || 'Unknown'}
            </p>
          </div>
          <span className="inline-block text-xs font-medium rounded-full px-2 py-1 bg-green-50 text-green-700">
            {course.status}
          </span>
        </div>
        {course.description && (
          <p className="mt-4 text-sm text-gray-600">{course.description}</p>
        )}
        {isAdmin && course.enrollments && course.enrollments.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Enrolled Students ({course.enrollments.length})</h3>
            <div className="flex flex-wrap gap-2">
              {course.enrollments.map((enr) => (
                <span key={enr.id} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-1">
                  {enr.student?.user?.fullName || 'Unknown'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
        {isTeacher && (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            {showUpload ? 'Cancel' : '+ Upload Content'}
          </button>
        )}
      </div>

      {showUpload && isTeacher && (
        <form onSubmit={handleUpload} className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
            >
              <option value="VIDEO">Video</option>
              <option value="DOCUMENT">Document</option>
              <option value="PDF">PDF</option>
              <option value="IMAGE">Image</option>
              <option value="LINK">Link</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">URL *</label>
            <input
              type="url"
              required
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
              placeholder="https://..."
            />
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
              {submitting ? 'Uploading...' : 'Upload Content'}
            </button>
          </div>
        </form>
      )}

      {content.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No content available yet.</div>
      ) : (
        <div className="space-y-3">
          {content.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-900">{item.title}</h3>
                  {typeBadge(item.type)}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                )}
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                  <span>Uploaded: {formatDate(item.createdAt)}</span>
                  <span>By: {item.uploadedBy?.fullName || 'Unknown'}</span>
                  {item.sizeBytes && <span>{(item.sizeBytes / 1024).toFixed(1)} KB</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-md text-xs font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  Open
                </a>
                {isTeacher && (
                  <button
                    onClick={() => handleArchive(item.id)}
                    disabled={archiving === item.id}
                    className="px-3 py-1 rounded-md text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}