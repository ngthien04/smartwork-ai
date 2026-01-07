import { fetcher } from '@/api/fetcher';
import type { User } from '@/types';

export interface LoginRequest {
  email: string;
  password: string;
}


export interface AuthResponse {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  avatarUrl?: string;
  token: string;
  isNewUser?: boolean; // Flag để biết user có phải là user mới không
}

// Chuẩn hoá response từ backend 
const mapBackendAuthResponse = (data: any): AuthResponse => {
  if (!data || !data.user) {
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      isAdmin: data.isAdmin ?? false,
      avatarUrl: data.avatarUrl,
      token: data.token,
      isNewUser: data.isNewUser,
    };
  }

  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name ?? '',
    isAdmin: data.user.isAdmin ?? false,
    avatarUrl: data.user.avatarUrl,
    token: data.token,
    isNewUser: data.isNewUser ?? false,
  };
};

export interface UpdateProfileRequest {
  name?: string;
  address?: string;
  avatarUrl?: string;
  preferences?: Record<string, any>;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}


export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.post('/users/login', credentials);
    return mapBackendAuthResponse(data);
  },

  getMe: async (): Promise<User> => {
    const { data } = await fetcher.get<User>('/users/me');
    return data;
  },

  
  updateProfile: async (profileData: UpdateProfileRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.put('/users/updateProfile', profileData);
    return mapBackendAuthResponse(data);
  },

  
  changePassword: async (passwordData: ChangePasswordRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.put('/users/changePassword', passwordData);
    return mapBackendAuthResponse(data);
  },


  googleLogin: async (credential: string): Promise<AuthResponse> => {
    const { data } = await fetcher.post('/users/google-login', { credential });
    return mapBackendAuthResponse(data);
  },
};
