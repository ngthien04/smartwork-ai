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
  // Đăng nhập
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.post<AuthResponse>('/users/login', credentials);
    return data;
  },

  // Đăng ký
  register: async (userData: RegisterRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.post<AuthResponse>('/users/register', userData);
    return data;
  },

  // Lấy thông tin user hiện tại
  getMe: async (): Promise<User> => {
    const { data } = await fetcher.get<User>('/users/me');
    return data;
  },

  // Cập nhật profile
  updateProfile: async (profileData: UpdateProfileRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.put<AuthResponse>('/users/updateProfile', profileData);
    return data;
  },

  // Đổi mật khẩu
  changePassword: async (passwordData: ChangePasswordRequest): Promise<AuthResponse> => {
    const { data } = await fetcher.put<AuthResponse>('/users/changePassword', passwordData);
    return data;
  },

  // Quên mật khẩu (tạm thời chỉ UI, chưa có API)
  forgotPassword: async (emailData: ForgotPasswordRequest): Promise<void> => {
    // TODO: Implement when backend API is ready
    throw new Error('API chưa được triển khai');
  },

  // Reset mật khẩu (tạm thời chỉ UI, chưa có API)
  resetPassword: async (resetData: ResetPasswordRequest): Promise<void> => {
    // TODO: Implement when backend API is ready
    throw new Error('API chưa được triển khai');
  },
};
