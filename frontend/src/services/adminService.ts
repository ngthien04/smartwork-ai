import api from './api';
import type { Team, TeamMember } from './teamService';

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  roles?: Array<{ team: string | null; role: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  page: number;
  limit: number;
  total: number;
  items: T[];
}

const adminService = {
  listUsers(params?: { page?: number; limit?: number; q?: string }) {
    return api.get<PaginatedResponse<AdminUser>>('/admin/users', { params });
  },

  getUserById(userId: string) {
    return api.get<AdminUser>(`/users/getById/${userId}`);
  },

  listTeams(params?: { page?: number; limit?: number; q?: string }) {
    return api.get<PaginatedResponse<Team>>('/admin/teams', { params });
  },

  getTeamById(teamId: string) {
    return api.get<Team>(`/teams/${teamId}`);
  },

  getTeamMembers(teamId: string) {
    return api.get<TeamMember[]>(`/teams/${teamId}/members`);
  },
};

export default adminService;


