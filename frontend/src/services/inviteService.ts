import api from './api';

export interface Invite {
  _id: string;
  team: string | { _id: string; name: string };
  email: string;
  role: 'member' | 'admin' | 'leader';
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InviteListResponse {
  page: number;
  limit: number;
  total: number;
  items: Invite[];
}

const inviteService = {
  // GET /api/invites?team=...
  list(params?: { team?: string; page?: number; limit?: number }) {
    return api.get<InviteListResponse>('/invites', { params });
  },

  // GET /api/invites/token/:token
  getByToken(token: string) {
    return api.get<Invite>(`/invites/token/${token}`);
  },

  // POST /api/invites/accept { token }
  accept(token: string) {
    return api.post('/invites/accept', { token });
  },

  // POST /api/invites/:inviteId/resend
  resend(inviteId: string) {
    return api.post(`/invites/${inviteId}/resend`);
  },

  // DELETE /api/invites/:inviteId
  cancel(inviteId: string) {
    return api.delete(`/invites/${inviteId}`);
  },

  listMine() {
    return api.get<{ items: Invite[] }>('/invites/mine');
  },
};

export default inviteService;
