import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// The current user ID is set by the AuthContext and injected here (dev only)
let currentUserId = 1;

export function setCurrentUserId(id: number) {
  currentUserId = id;
}

// Only inject X-Current-User-Id header in development (for DevToolbar user switching)
if (import.meta.env.DEV) {
  api.interceptors.request.use((config) => {
    config.headers['X-Current-User-Id'] = String(currentUserId);
    return config;
  });
}

// Handle expired session — reload to show login page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.response?.data?.error?.code === 'AUTH_REQUIRED'
    ) {
      window.location.reload();
    }
    return Promise.reject(error);
  }
);
