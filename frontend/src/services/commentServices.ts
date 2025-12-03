
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
  mentions?: string[]; 
}

export interface UpdateCommentPayload {
  content: string;
}

const commentServices = {
  
  list(params: CommentListParams) {
    return api.get<{ items: Comment[]; total: number; page: number; limit: number }>(
      '/comments',
      { params },
    );
  },

  
  create(payload: CreateCommentPayload) {
    return api.post<Comment>('/comments', payload);
  },

  
  update(commentId: string, payload: UpdateCommentPayload) {
    return api.put<Comment>(`/comments/${commentId}`, payload);
  },

  
  remove(commentId: string) {
    return api.delete(`/comments/${commentId}`);
  },
};

export default commentServices;
