import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthContextValue, AuthState } from './types';
import { bootstrapSession, logoutSession, refreshSession, signIn, signUp } from './client';
import type { AuthSession } from '../types/domain';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const initialState: AuthState = {
  status: 'loading',
  session: null,
  error: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let active = true;
    bootstrapSession()
      .then((session) => {
        if (!active) return;
        setState({
          status: session ? 'authenticated' : 'unauthenticated',
          session,
          error: null,
        });
      })
      .catch((error: Error) => {
        if (!active) return;
        setState({
          status: 'unauthenticated',
          session: null,
          error: error.message,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    updateSession: (session: AuthSession | null) =>
      setState({
        status: session ? 'authenticated' : 'unauthenticated',
        session,
        error: null,
      }),
    refresh: async () => {
      const session = await refreshSession();
      setState({
        status: 'authenticated',
        session,
        error: null,
      });
      return session;
    },
    login: async (input) => {
      const session = await signIn(input);
      setState({
        status: 'authenticated',
        session,
        error: null,
      });
      return session;
    },
    signUp: async (input) => {
      const session = await signUp(input);
      setState({
        status: 'authenticated',
        session,
        error: null,
      });
      return session;
    },
    logout: async () => {
      await logoutSession();
      setState({
        status: 'unauthenticated',
        session: null,
        error: null,
      });
    },
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

export function useSession() {
  const { session, status, error } = useAuth();
  return { session, status, error };
}
