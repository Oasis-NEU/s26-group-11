import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5001',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  // Send the httpOnly JWT cookie automatically on every request.
  // The cookie is set by the backend and is never accessible to JavaScript.
  withCredentials: true,
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    console.error('[api]', status, err?.config?.url);

    // When any API call returns 401 the JWT cookie has expired or is missing.
    // Clear local auth state and send the user back to the login page so they
    // can get a fresh token. Skip the redirect for auth endpoints themselves
    // (login / register) to avoid an infinite redirect loop.
    if (status === 401) {
      const url: string = err?.config?.url ?? '';
      const isAuthEndpoint = url.includes('/api/auth/login') ||
                             url.includes('/api/auth/register') ||
                             url.includes('/api/auth/reset-password') ||
                             url.includes('/api/auth/forgot-password');

      if (!isAuthEndpoint) {
        // Lazily import the store to avoid a circular dependency at module load time
        import('../store/useAuth').then(({ useAuth }) => {
          // Clear persisted auth state (email, username, etc.)
          const state = useAuth.getState();
          state.logout();
        }).catch(() => {/* ignore */});

        // Only redirect if not already on the auth page
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth';
        }
      }
    }

    return Promise.reject(err);
  }
);

export default client;
