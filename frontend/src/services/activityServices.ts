import api from './api';
import type { Activity } from '@/types/activity';

export interface ActivityListResponse {
  page: number;
  limit: number;
  total: number;
  items: Activity[];
}

const activityServices = {
  // GET /api/activities?targetType=task&targetId=...
  list(params: {
    team?: string;
    targetType?: string;
    targetId?: string;
    actor?: string;
    verb?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    return api.get<ActivityListResponse>('/activities', { params });
  },
};

export default activityServices;
export type { Activity };
