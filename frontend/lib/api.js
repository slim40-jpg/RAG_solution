import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Handle 401 errors ONLY for protected routes
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // ✅ Only redirect to login if we're NOT on login/register pages
      const isAuthPage = typeof window !== 'undefined' && 
        (window.location.pathname === '/login' || 
         window.location.pathname === '/register');
      
      // ✅ Also check if the request is to a public endpoint
      const isPublicEndpoint = error.config?.url?.includes('/api/auth/') || 
                               error.config?.url?.includes('/health');
      
      if (!isAuthPage && !isPublicEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
};

// Department API
export const departmentAPI = {
  getAll: () => api.get('/api/departments'),
  getById: (id) => api.get(`/api/departments/${id}`),
  create: (data) => api.post('/api/departments', data),
  update: (id, data) => api.put(`/api/departments/${id}`, data),
  delete: (id) => api.delete(`/api/departments/${id}`),
};

// Document API
export const documentAPI = {
  getAll: (params) => api.get('/api/documents', { params }),
  getById: (id) => api.get(`/api/documents/${id}`),
  upload: (formData) => api.post('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/api/documents/${id}`),
};

// Search API
export const searchAPI = {
  search: (params) => api.get('/api/search', { params }),
  hybridSearch: (params) => api.get('/api/search/hybrid', { params }),
};

// Chat API
export const chatAPI = {
  ask: (data) => api.post('/api/chat', data),
  askStream: (data) => {
    return fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
  },
};

// User API
export const userAPI = {
  getAll: () => api.get('/api/users'),
  getById: (id) => api.get(`/api/users/${id}`),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`),
  updateRole: (id, role) => api.put(`/api/users/${id}/role`, { role }),
};
// Archive Box API
export const archiveBoxAPI = {
  getAll: () => api.get('/api/archive-boxes'),
  getById: (id) => api.get(`/api/archive-boxes/${id}`),
  create: (data) => api.post('/api/archive-boxes', data),
  update: (id, data) => api.put(`/api/archive-boxes/${id}`, data),
  delete: (id) => api.delete(`/api/archive-boxes/${id}`),
  assignDocument: (data) => api.post('/api/archive-boxes/assign', data),
  removeDocument: (documentId) => api.delete(`/api/archive-boxes/${documentId}/remove`),
};
export default api;