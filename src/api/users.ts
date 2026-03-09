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

export async function updateMe(updates: { username?: string; bio?: string; avatarUrl?: string }): Promise<ApiUser> {
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
  const { data } = await apiClient.post<{ url: string }>('/upload', formData);
  return data.url;
}
