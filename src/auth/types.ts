import type { ReactNode } from 'react';
import type { AuthSession, User } from '../types/domain';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  refresh: () => Promise<AuthSession | null>;
  login: (input: { email: string; password: string }) => Promise<AuthSession>;
  signUp: (input: { email: string; password: string; name: string }) => Promise<AuthSession>;
  logout: () => Promise<void>;
  updateSession: (session: AuthSession | null) => void;
}

export interface RequireAuthProps {
  children: ReactNode;
  loadingFallback?: ReactNode;
  unauthenticatedFallback?: ReactNode;
  onUnauthenticated?: () => void;
}

export interface SessionBootstrapResult {
  session: AuthSession | null;
  user: User | null;
}
