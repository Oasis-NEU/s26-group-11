import client from './client';

export interface AuthUser {
  id:          number;
  email:       string;
  username:    string | null;
  first_name:  string | null;
  last_name:   string | null;
  bio:         string | null;
  avatar_url:  string | null;
  is_admin:    boolean;
  created_at:  string;
}

export interface AdminUser {
  id:         number;
  email:      string;
  username:   string | null;
  is_admin:   boolean;
  created_at: string;
}

export const adminListUsers = () =>
  client.get<AdminUser[]>('/api/auth/admin/users').then(r => r.data);

export const adminDeleteUser = (uid: number) =>
  client.delete(`/api/auth/admin/users/${uid}`).then(r => r.data);

export interface AuthResponse extends AuthUser {
  token: string;
}

export interface ProfileUpdatePayload {
  username?:         string;
  first_name?:       string;
  last_name?:        string;
  bio?:              string;
  avatar_url?:       string | null;
  current_password?: string;
  new_password?:     string;
}

export const register = (email: string, password: string, username?: string) =>
  client.post<AuthResponse>('/api/auth/register', { email, password, ...(username ? { username } : {}) }).then((r) => r.data);

export const registerRequest = (email: string, password: string, username?: string) =>
  client.post<{ token: string; dev_otp?: string } | AuthResponse>('/api/auth/register', {
    email, password, ...(username ? { username } : {}),
  }).then((r) => r.data);

export const registerVerify = (token: string, otp: string) =>
  client.post<AuthResponse>('/api/auth/register/verify', { token, otp }).then((r) => r.data);

export const login = (email: string, password: string) =>
  client.post<AuthResponse>('/api/auth/login', { email, password }).then((r) => r.data);

export const getMe = () =>
  client.get<AuthUser>('/api/auth/me').then((r) => r.data);

export const updateProfile = (payload: ProfileUpdatePayload) =>
  client.put<AuthUser>('/api/auth/profile', payload).then((r) => r.data);

export const logoutApi = () =>
  client.post('/api/auth/logout').then((r) => r.data);

export const forgotPassword = (email: string) =>
  client.post<{ message: string; dev_token?: string }>('/api/auth/forgot-password', { email }).then((r) => r.data);

export const resetPassword = (token: string, new_password: string) =>
  client.post<{ message: string }>('/api/auth/reset-password', { token, new_password }).then((r) => r.data);
