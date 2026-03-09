import apiClient from './client';

export interface ApiComment {
  id: string;
  text: string;
  timestamp: string;
  author: { id: string; username: string; avatarUrl: string };
}

export interface ApiPost {
  id: string;
  caption: string;
  textBackground?: string;
  text_background?: string;
  created_at: string;
  author: { id: string; username: string; avatarUrl: string };
  images: string[];
  likes: number;
  hasLiked: boolean;
  savedToFridge: boolean;
  commentsCount: number;
}

export async function getFeed(): Promise<ApiPost[]> {
  const { data } = await apiClient.get<ApiPost[]>('/posts/feed');
  return data;
}

export async function getUserPosts(userId: string): Promise<ApiPost[]> {
  const { data } = await apiClient.get<ApiPost[]>(`/posts/user/${userId}`);
  return data;
}

export async function getUserFridgePosts(userId: string): Promise<ApiPost[]> {
  const { data } = await apiClient.get<ApiPost[]>(`/posts/fridge/${userId}`);
  return data;
}

export async function createPost(payload: {
  caption: string;
  textBackground?: string;
  images?: string[];
}): Promise<ApiPost> {
  const { data } = await apiClient.post<ApiPost>('/posts', payload);
  return data;
}

export async function updatePost(id: string, caption: string): Promise<ApiPost> {
  const { data } = await apiClient.patch<ApiPost>(`/posts/${id}`, { caption });
  return data;
}

export async function deletePost(id: string): Promise<void> {
  await apiClient.delete(`/posts/${id}`);
}

export async function likePost(id: string) {
  const { data } = await apiClient.post<{ likes: number; hasLiked: boolean }>(`/posts/${id}/like`);
  return data;
}

export async function unlikePost(id: string) {
  const { data } = await apiClient.delete<{ likes: number; hasLiked: boolean }>(`/posts/${id}/like`);
  return data;
}

export async function saveToFridge(id: string) {
  const { data } = await apiClient.post<{ savedToFridge: boolean }>(`/posts/${id}/fridge`);
  return data;
}

export async function removeFromFridge(id: string) {
  const { data } = await apiClient.delete<{ savedToFridge: boolean }>(`/posts/${id}/fridge`);
  return data;
}

export async function getComments(postId: string): Promise<ApiComment[]> {
  const { data } = await apiClient.get<ApiComment[]>(`/posts/${postId}/comments`);
  return data;
}

export async function addComment(postId: string, text: string): Promise<ApiComment> {
  const { data } = await apiClient.post<ApiComment>(`/posts/${postId}/comments`, { text });
  return data;
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
}
