import { fetcher } from '@/api/fetcher';
import type { User } from '@/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  address?: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  avatarUrl?: string;
  token: string;
}

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

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const authService = {
  
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.post<AuthResponse>('/users/login', credentials);
    return data;
  },

  
  register: async (userData: RegisterRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.post<AuthResponse>('/users/register', userData);
    return data;
  },

  
  getMe: async (): Promise<User> => {
    const { data } = await fetcher.get<User>('/users/me');
    return data;
  },

  
  updateProfile: async (profileData: UpdateProfileRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.put<AuthResponse>('/users/updateProfile', profileData);
    return data;
  },

  
  changePassword: async (passwordData: ChangePasswordRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.put<AuthResponse>('/users/changePassword', passwordData);
    return data;
  },

  
  forgotPassword: async (emailData: ForgotPasswordRequest): Promise<void> => {
    
    throw new Error('API chưa được triển khai');
  },

  
  resetPassword: async (resetData: ResetPasswordRequest): Promise<void> => {
    
    throw new Error('API chưa được triển khai');
  },
};
