// services/inviteService.ts
import api from './api';

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type InviteRole = 'member' | 'admin' | 'leader';

export interface Invite {
  _id: string;

  team: string | { _id: string; name: string; slug?: string };
  email: string;
  role: InviteRole;

  token: string;
  expiresAt: string;

  status: InviteStatus;

  invitedBy?: string;
  acceptedAt?: string;
  declinedAt?: string;
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
  // ✅ leader/admin list invites of team
  list(params?: { team?: string; page?: number; limit?: number }) {
    return api.get<InviteListResponse>('/invites', { params });
  },

  // ✅ preview invite (token) - dùng cho accept/decline page
  getByToken(token: string) {
    return api.get<Invite>(`/invites/token/${token}`);
  },

  // ✅ create + send email (Mailjet)
  create(payload: { team: string; email: string; role?: InviteRole }) {
    // backend: POST /invites { team, email, role }
    // response: { ok: true, expiresAt }
    return api.post<{ ok: true; expiresAt: string }>('/invites', payload);
  },

  accept(token: string) {
    return api.post<{ ok: true; status: 'accepted'; teamId: string }>('/invites/accept', { token });
  },

  decline(token: string) {
    return api.post<{ ok: true; status: 'declined' }>('/invites/decline', { token });
  },

  cancel(inviteId: string) {
    return api.delete<{ ok: true }>(`/invites/${inviteId}`);
  },

  listMine() {
    return api.get<{ items: Invite[] }>('/invites/mine');
  },
};

export default inviteService;