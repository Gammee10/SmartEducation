import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses - clear the session and notify the app softly.
// We deliberately avoid a hard page reload here: it destroys any
// in-progress work (quiz answers, grading drafts, forms). Instead the
// AuthContext listens for this event, clears user state, and protected
// routes redirect through React Router while remembering the original
// destination so the user can be returned after re-authenticating.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest = typeof error.config?.url === 'string' && error.config.url.includes('/auth/login');
    const hadToken = !!error.config?.headers?.Authorization;
    if (error.response?.status === 401 && hadToken && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        try {
          sessionStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
        } catch {
          // sessionStorage unavailable - skip remembering the redirect
        }
      }
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;