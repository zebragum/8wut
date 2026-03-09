import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout, changePassword as apiChangePassword } from './api/auth';
import { updateMe } from './api/users';
import type { ApiUser } from './api/auth';

type AuthContextType = {
  currentUser: ApiUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, inviteCode: string) => Promise<void>;
  logout: () => void;
  updatePassword: (currentPass: string, newPass: string) => Promise<void>;
  updateUsername: (newName: string) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('8wut-token');
    if (!token) { setLoading(false); return; }
    try {
      const user = await getMe();
      setCurrentUser(user);
    } catch {
      localStorage.removeItem('8wut-token');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const { user } = await apiLogin(username, password);
    setCurrentUser(user);
  };

  const register = async (username: string, password: string, inviteCode: string) => {
    const { user } = await apiRegister(username, password, inviteCode);
    setCurrentUser(user);
  };

  const logout = () => {
    apiLogout();
    setCurrentUser(null);
  };

  const updatePassword = async (currentPass: string, newPass: string) => {
    await apiChangePassword(currentPass, newPass);
  };

  const updateUsername = async (newName: string) => {
    if (!newName.trim() || !currentUser) return;
    const updated = await updateMe({ username: newName.trim() });
    setCurrentUser(prev => prev ? { ...prev, ...updated } : prev);
  };

  const updateAvatar = async (avatarUrl: string) => {
    if (!currentUser) return;
    const updated = await updateMe({ avatarUrl });
    setCurrentUser(prev => prev ? { ...prev, ...updated } : prev);
  };

  return (
    <AuthContext.Provider value={{
      currentUser, loading,
      login, register, logout,
      updatePassword, updateUsername, updateAvatar,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
