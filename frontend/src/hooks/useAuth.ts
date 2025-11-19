// src/hooks/useAuth.ts
import { useAuthContext } from "@/contexts/AuthContext";
import type { AuthUser } from "@/types/auth";

export function useAuth(): { user: AuthUser | null } {
  const { user } = useAuthContext();
  return { user };
}
