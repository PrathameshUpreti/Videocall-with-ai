'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

// Define types
export interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check if user is logged in on initial load
  useEffect(() => {
    const checkUserLoggedIn = async () => {
      try {
        const { data } = await axios.get('/api/auth/me');
        if (data.success) {
          setUser(data.user);
        }
      } catch (error) {
        // User is not logged in, that's okay
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkUserLoggedIn();
  }, []);

  // Register user
  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/auth/register', {
        username,
        email,
        password
      });
      
      if (data.success) {
        setUser(data.user);
        router.push('/');
        return true;
      }
      return false;
    } catch (error: any) {
      setError(error.response?.data?.message || 'Something went wrong');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Login user
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.post('/api/auth/login', {
        email,
        password
      });
      
      if (data.success) {
        setUser(data.user);
        router.push('/');
        return true;
      }
      return false;
    } catch (error: any) {
      setError(error.response?.data?.message || 'Invalid credentials');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout user
  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const { data } = await axios.post('/api/auth/logout');
      
      if (data.success) {
        setUser(null);
        router.push('/login');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        register,
        login,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 