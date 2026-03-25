import apiClient from './client';
import type { ApiUser } from './auth';

export interface ApiNotification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'fridge';
  read: boolean;
  timestamp: string;
  user: { id: string; username: string; avatarUrl: string };
  postImage?: string;
}

export async function getUser(userId: string): Promise<ApiUser> {
  const { data } = await apiClient.get<ApiUser>(`/users/${userId}`);
  return data;
}

export async function updateMe(updates: { username?: string; bio?: string; avatarUrl?: string; bioColor?: string }): Promise<ApiUser> {
  const { data } = await apiClient.patch<ApiUser>('/users/me', updates);
  return data;
}

export async function followUser(userId: string) {
  const { data } = await apiClient.post<{ isFollowing: boolean }>(`/users/${userId}/follow`);
  return data;
}

export async function unfollowUser(userId: string) {
  const { data } = await apiClient.delete<{ isFollowing: boolean }>(`/users/${userId}/follow`);
  return data;
}

export async function getFollowers(userId: string): Promise<ApiUser[]> {
  const { data } = await apiClient.get<ApiUser[]>(`/users/${userId}/followers`);
  return data;
}

export async function getFollowing(userId: string): Promise<ApiUser[]> {
  const { data } = await apiClient.get<ApiUser[]>(`/users/${userId}/following`);
  return data;
}

export async function searchUsers(query: string): Promise<ApiUser[]> {
  const { data } = await apiClient.get<ApiUser[]>(`/users/search?q=${encodeURIComponent(query)}`);
  return data;
}

export async function getNotifications(): Promise<ApiNotification[]> {
  const { data } = await apiClient.get<ApiNotification[]>('/notifications');
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('8wut-token');
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const data = await response.json();
  return data.url;
}
