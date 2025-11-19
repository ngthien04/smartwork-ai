// src/services/projectServices.ts
import api from './api';
import { DEFAULT_TEAM_ID } from '@/data/mockData'; // team mock nhưng id phải tồn tại ở BE

export interface ProjectListParams {
  team?: string;        
  q?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface CreateProjectPayload {
  name: string;
  key: string;
  description?: string;
  lead?: string;
  teamId?: string;      
}

const projectServices = {
  // GET /api/projects
  list(params: ProjectListParams = {}) {
    const team = params.team || DEFAULT_TEAM_ID;

    return api.get('/projects', {
      params: {
        ...params,
        team,
        ...(typeof params.isArchived === 'boolean'
          ? { isArchived: String(params.isArchived) }
          : {}),
      },
    });
  },

  // GET /api/projects/:projectId
  getById(projectId: string) {
    return api.get(`/projects/${projectId}`);
  },

  // POST /api/projects
  create(payload: CreateProjectPayload) {
    const team = payload.teamId || DEFAULT_TEAM_ID;

    return api.post('/projects', {
      team,
      name: payload.name,
      key: payload.key,
      description: payload.description,
      lead: payload.lead,
    });
  },
};

export default projectServices;