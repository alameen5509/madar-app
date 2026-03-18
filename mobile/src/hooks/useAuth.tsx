import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { getAccessToken, setTokens, clearTokens, parseJwt } from '../lib/auth';
import { authApi } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  userEmail: null,
  userRole: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const extractUser = (token: string) => {
    const payload = parseJwt(token);
    if (payload) {
      setUserId((payload.sub ?? payload.nameid) as string);
      setUserEmail((payload.email ?? payload.unique_name) as string);
      setUserRole(
        (payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
          payload.role) as string
      );
    }
  };

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (token) {
        setIsAuthenticated(true);
        extractUser(token);
      }
      setIsLoading(false);
    })();
  }, []);

  // Auth guard
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(main)');
    }
  }, [isAuthenticated, segments, isLoading]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    await setTokens(data.accessToken, data.refreshToken);
    extractUser(data.accessToken);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    await authApi.register(fullName, email, password);
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await clearTokens();
    setIsAuthenticated(false);
    setUserId(null);
    setUserEmail(null);
    setUserRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, userId, userEmail, userRole, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
