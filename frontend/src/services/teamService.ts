// src/services/teamService.ts
import api from './api';

export interface TeamMemberUserLite {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export type TeamRole = 'member' | 'admin' | 'leader';

export interface TeamMember {
  user: string | TeamMemberUserLite;
  role: TeamRole;
  joinedAt?: string;
}

export interface Team {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  members?: TeamMember[];
  isArchived?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamListResponse {
  page: number;
  limit: number;
  total: number;
  items: Team[];
}

const teamService = {
  // GET /api/teams  -> list team mà user hiện tại đang ở trong
  listMyTeams() {
    return api.get<TeamListResponse>('/teams');
  },

  // GET /api/teams/:teamId
  getById(teamId: string) {
    return api.get<Team>(`/teams/${teamId}`);
  },

  // GET /api/teams/:teamId/members
  getMembers(teamId: string) {
    return api.get<TeamMember[]>(`/teams/${teamId}/members`);
  },

  // POST /api/teams  -> tạo team mới
  createTeam(payload: { name: string; slug: string; description?: string }) {
    return api.post<Team>('/teams', payload);
  },

  // POST /api/teams/:teamId/invites  -> mời member
  inviteMember(teamId: string, email: string, role: TeamRole = 'member') {
    return api.post<{ token: string; expiresAt: string }>(
      `/teams/${teamId}/invites`,
      { email, role },
    );
  },

  // POST /api/teams/:teamId/members  -> thêm / đổi role của 1 user trong team
  updateMemberRole(teamId: string, userId: string, role: TeamRole) {
    return api.post<TeamMember[]>(
      `/teams/${teamId}/members`,
      { userId, role },
    );
  },

  // DELETE /api/teams/:teamId/members/:userId  -> kick member / rời team
  removeMember(teamId: string, userId: string) {
    return api.delete(`/teams/${teamId}/members/${userId}`);
  },

  // DELETE /api/teams/:teamId  -> giải tán team (chỉ leader)
  deleteTeam(teamId: string) {
    return api.delete(`/teams/${teamId}`);
  },

  getBySlug(slug: string): Promise<Team> {
    return api.get(`/teams/slug/${slug}`);
  },
};

export default teamService;