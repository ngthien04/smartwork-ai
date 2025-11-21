// src/services/commentServices.ts
import api from './api';
import type { Comment } from '@/types/comment';

export interface CommentListParams {
  task: string;
  page?: number;
  limit?: number;
}

export interface CreateCommentPayload {
  task: string;
  content: string;
  mentions?: string[]; // danh sách userId được mention
}

export interface UpdateCommentPayload {
  content: string;
}

const commentServices = {
  // GET /api/comments?task=&page=&limit=
  list(params: CommentListParams) {
    return api.get<{ items: Comment[]; total: number; page: number; limit: number }>(
      '/comments',
      { params },
    );
  },

  // POST /api/comments
  create(payload: CreateCommentPayload) {
    return api.post<Comment>('/comments', payload);
  },

  // PUT /api/comments/:commentId
  update(commentId: string, payload: UpdateCommentPayload) {
    return api.put<Comment>(`/comments/${commentId}`, payload);
  },

  // DELETE /api/comments/:commentId
  remove(commentId: string) {
    return api.delete(`/comments/${commentId}`);
  },
};

export default commentServices;
