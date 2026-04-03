import React, { useEffect } from 'react';
import { useAuth } from './session';
import type { RequireAuthProps } from './types';

export function RequireAuth({
  children,
  loadingFallback = null,
  unauthenticatedFallback = null,
  onUnauthenticated,
}: RequireAuthProps) {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') onUnauthenticated?.();
  }, [onUnauthenticated, status]);

  if (status === 'loading') return <>{loadingFallback}</>;
  if (status === 'unauthenticated') return <>{unauthenticatedFallback}</>;
  return <>{children}</>;
}

export function useRedirectOnLogout(onRedirect: () => void) {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') onRedirect();
  }, [onRedirect, status]);
}
