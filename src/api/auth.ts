import apiClient from './client';

export interface ApiUser {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  is_admin: boolean;
  created_at: string;
  followers_count?: number;
  following_count?: number;
  post_count?: number;
  is_following?: boolean;
}

export async function login(username: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: ApiUser }>('/auth/login', { username, password });
  localStorage.setItem('8wut-token', data.token);
  return data;
}

export async function register(username: string, password: string, inviteCode: string) {
  const { data } = await apiClient.post<{ token: string; user: ApiUser }>('/auth/register', {
    username, password, inviteCode
  });
  localStorage.setItem('8wut-token', data.token);
  return data;
}

export async function getMe(): Promise<ApiUser> {
  const { data } = await apiClient.get<ApiUser>('/auth/me');
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}

export function logout() {
  localStorage.removeItem('8wut-token');
  localStorage.removeItem('8wut-user');
}
