
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

  
  getById(projectId: string) {
    return api.get(`/projects/${projectId}`);
  },

  
  create(payload: CreateProjectPayload) {
    return api.post('/projects', payload);
  },

  
  update(projectId: string, payload: UpdateProjectPayload) {
    return api.put(`/projects/${projectId}`, payload);
  },

  
  archive(projectId: string, isArchived = true) {
    return api.put(`/projects/${projectId}/archive`, { isArchived });
  },

  
  delete(projectId: string) {
    return api.delete(`/projects/${projectId}`);
  },

  
  getOverview(projectId: string) {
    return api.get(`/projects/${projectId}/stats/overview`);
  },
};

export default projectServices;
