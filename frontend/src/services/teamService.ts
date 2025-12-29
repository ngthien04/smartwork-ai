// services/teamService.ts
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
  listMyTeams() {
    return api.get<TeamListResponse>('/teams');
  },

  getById(teamId: string) {
    return api.get<Team>(`/teams/${teamId}`);
  },

  getMembers(teamId: string) {
    return api.get<TeamMember[]>(`/teams/${teamId}/members`);
  },

  createTeam(payload: { name: string; slug: string; description?: string }) {
    return api.post<Team>('/teams', payload);
  },

  updateMemberRole(teamId: string, userId: string, role: TeamRole) {
    return api.post<TeamMember[]>(`/teams/${teamId}/members`, { userId, role });
  },

  removeMember(teamId: string, userId: string) {
    return api.delete(`/teams/${teamId}/members/${userId}`);
  },

  deleteTeam(teamId: string) {
    return api.delete(`/teams/${teamId}`);
  },

  getBySlug(slug: string) {
    return api.get<Team>(`/teams/slug/${slug}`);
  },
};

export default teamService;