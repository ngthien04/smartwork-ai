// src/services/projectService.ts
import api from './api';

export interface ProjectListParams {
  team: string;            
  q?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface CreateProjectPayload {
  team: string;           
  name: string;
  key: string;
  description?: string;
  lead?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  key?: string;
  description?: string;
  lead?: string | null;
  isArchived?: boolean;
}

const projectServices = {
  // GET /api/projects
  list(params: ProjectListParams) {
    return api.get('/projects', {
      params: {
        ...params,
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
    return api.post('/projects', payload);
  },

  // PUT /api/projects/:projectId
  update(projectId: string, payload: UpdateProjectPayload) {
    return api.put(`/projects/${projectId}`, payload);
  },

  // PUT /api/projects/:projectId/archive
  archive(projectId: string, isArchived = true) {
    return api.put(`/projects/${projectId}/archive`, { isArchived });
  },

  // DELETE /api/projects/:projectId
  delete(projectId: string) {
    return api.delete(`/projects/${projectId}`);
  },

  // GET /api/projects/:projectId/stats/overview
  getOverview(projectId: string) {
    return api.get(`/projects/${projectId}/stats/overview`);
  },
};

export default projectServices;
