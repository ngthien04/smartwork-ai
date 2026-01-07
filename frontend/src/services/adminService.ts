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

export interface AdminPlanStatsResponse {
  planStats: {
    totalTeams: number;
    freeTeams: number;
    premiumTeams: number;
    activePremiumTeams: number;
  };
  revenueStats: {
    totalRevenue: number;
    totalPayments: number;
    successPayments: number;
    failedPayments: number;
    pendingPayments: number;
  };
}

export interface AdminPayment {
  _id: string;
  team?: {
    _id: string;
    name: string;
    slug: string;
    plan?: 'FREE' | 'PREMIUM';
    planExpiredAt?: string;
  } | null;
  amount: number;
  currency: string;
  provider: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  plan: 'PREMIUM';
  transactionId?: string;
  createdAt?: string;
  paidAt?: string;
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

  // ---------- PLAN MANAGEMENT ----------
  getPlanSummary() {
    return api.get<AdminPlanStatsResponse>('/admin/plans/summary');
  },

  listPlanTeams(params?: { page?: number; limit?: number; plan?: 'FREE' | 'PREMIUM' }) {
    return api.get<PaginatedResponse<Team>>('/admin/plans/teams', { params });
  },

  listPlanPayments(params?: {
    page?: number;
    limit?: number;
    status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  }) {
    return api.get<PaginatedResponse<AdminPayment>>('/admin/plans/payments', { params });
  },
};

export default adminService;
