import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };

// Shared axios instance. Teammates: import { api } from '../api/client.js' - auth + refresh are automatic.
export const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// Single-flight refresh: concurrent 401s share one refresh call (refresh tokens rotate).
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((r) => { setAccessToken(r.data.data.accessToken); return r.data.data; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && original && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event('auth:logout'));
      }
    }
    return Promise.reject(err);
  },
);

export const errMsg = (e) => e.response?.data?.error?.message || e.message || 'Something went wrong';
