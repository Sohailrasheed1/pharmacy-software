'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UserSession {
  id: number;
  username: string;
  role: 'Owner' | 'Cashier' | string;
  name: string;
}

interface AuthContextType {
  currentUser: UserSession | null;
  isLoaded: boolean;
  login: (user: UserSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoaded: false,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pharmacy_user');
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse pharmacy_user', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const login = (user: UserSession) => {
    localStorage.setItem('pharmacy_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem('pharmacy_user');
    setCurrentUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
