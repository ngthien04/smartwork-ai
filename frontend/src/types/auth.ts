// src/types/auth.ts
export interface UserRole {
  team: string | null;
  role: string;
}

export interface AuthUser {
  _id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  roles?: UserRole[];
}
