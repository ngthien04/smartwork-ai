
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

export interface AuthUser {
  _id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  roles?: Array<{ team: string | null; role: string; _id?: string }>;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const syncUser = () => {
      const rawAuth = localStorage.getItem('auth');
      const token = localStorage.getItem('token');

      if (rawAuth) {
        try {
          const parsed = JSON.parse(rawAuth);
          if (parsed.user) {
            setUser(parsed.user);
            return;
          }
        } catch (err) {
          console.error('Invalid stored auth', err);
        }
      }

      if (token) {
        try {
          const decoded: any = jwtDecode(token);
          const u: AuthUser = {
            _id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            isAdmin: decoded.isAdmin,
            roles: decoded.roles,
          };
          setUser(u);
          return;
        } catch (err) {
          console.error('Invalid token', err);
        }
      }

      setUser(null);
    };

    syncUser();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'auth' || e.key === 'token' || e.key === null) {
        syncUser();
      }
    };
    const handleAuthChanged = () => syncUser();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth-changed', handleAuthChanged);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth-changed', handleAuthChanged);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
