import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5001',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[api]', err?.response?.status, err?.config?.url);
    return Promise.reject(err);
  }
);

export default client;
