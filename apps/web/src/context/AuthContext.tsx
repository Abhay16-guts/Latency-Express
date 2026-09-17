import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@latency-express/types';
import { api, getAuthToken, setAuthToken, clearAuthToken } from '../lib/api.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.auth.me()
        .then((data) => setUser(data.user))
        .catch(() => clearAuthToken())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const data = await api.auth.login({ email, password: pass });
    setAuthToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, pass: string, fullName: string) => {
    const data = await api.auth.register({ email, password: pass, fullName });
    setAuthToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
