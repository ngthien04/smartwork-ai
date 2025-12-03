
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
    const raw = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (raw && raw !== '{}') {
      setUser(JSON.parse(raw));
    } else if (token) {
      try {
        const decoded: any = jwtDecode(token);

        
        console.log('Decoded JWT:', decoded);

        const u: AuthUser = {
          _id: decoded.id,
          email: decoded.email,
          name: decoded.name,
          isAdmin: decoded.isAdmin,
          roles: decoded.roles,
        };
        setUser(u);
      } catch (err) {
        console.error('Invalid token', err);
        setUser(null);
      }
    }
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
