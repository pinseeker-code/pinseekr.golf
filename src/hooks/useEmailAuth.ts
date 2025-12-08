import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { generateEmailUser, loginEmailUser, type EmailUser } from '@/lib/emailAuthService';

interface UseEmailAuthReturn {
  isLoading: boolean;
  error: string | null;
  signup: (email: string, password: string) => Promise<EmailUser>;
  login: (email: string, password: string) => Promise<EmailUser>;
  logout: () => void;
}

export function useEmailAuth(): UseEmailAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const signup = useCallback(async (email: string, password: string): Promise<EmailUser> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate password strength
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const user = await generateEmailUser(email, password);
      
      toast({
        title: "Account created successfully!",
        description: "Welcome to PinSeekr Golf. Your account is ready to use.",
      });

      return user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const login = useCallback(async (email: string, password: string): Promise<EmailUser> => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await loginEmailUser(email, password);
      
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in to your account.",
      });

      return user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log in';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(() => {
    // Clear any cached email user data
    localStorage.removeItem('email_user_session');
    
    toast({
      title: "Logged out",
      description: "You've been successfully logged out.",
    });
  }, [toast]);

  return {
    isLoading,
    error,
    signup,
    login,
    logout,
  };
}

// Validation helpers
export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) return 'Email is required';
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
};

export const validatePassword = (password: string, isSignup = false): string | null => {
  if (!password) return 'Password is required';
  if (isSignup && password.length < 8) return 'Password must be at least 8 characters long';
  if (isSignup && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
  }
  return null;
};

export const validateConfirmPassword = (password: string, confirmPassword: string): string | null => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};