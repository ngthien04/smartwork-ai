import type { ID, TeamRole, AuthProvider } from "./common";

export interface User {
  _id?: ID;
  id: ID;
  email: string;
  name: string;
  avatarUrl?: string;
  avatar?: string; 
  isAdmin?: boolean;
  preferences?: {
    locale?: string;
    timezone?: string;
    notification?: {
      email?: boolean;
      web?: boolean;
      mobile?: boolean;
    };
  };
  roles?: Array<{
    team: ID;
    role: TeamRole;
  }>;
  authProviders?: Array<{
    provider: AuthProvider;
    providerId?: string;
  }>;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// state slice liên quan tới auth
export interface AuthState {
  user: User | null;
  token: string | null;
  status: "idle" | "loading" | "succeeded" | "failed";
}
