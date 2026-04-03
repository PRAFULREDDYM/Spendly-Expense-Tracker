import React, { useEffect } from 'react';
import { LoaderCircle, UsersRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmptyState, PageShell } from '../components/shell';
import { useGroupsQuery, useGroupMutations } from '../hooks';

export default function InvitePage({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const { acceptInviteMutation } = useGroupMutations();
  const groupsQuery = useGroupsQuery(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !token || acceptInviteMutation.isPending || acceptInviteMutation.isSuccess) {
      return;
    }

    void acceptInviteMutation.mutateAsync(token).then(() => {
      void groupsQuery.refetch().then((result) => {
        const nextGroup = result.data?.[0];
        navigate(nextGroup ? `/groups/${nextGroup.id}` : '/profile', { replace: true });
      });
    }).catch(() => undefined);
  }, [acceptInviteMutation, groupsQuery, isAuthenticated, navigate, token]);

  if (!token) {
    return (
      <PageShell className="pt-6">
        <EmptyState
          icon="group"
          title="Invite not found"
          description="This invite link is missing a token."
          action={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard') }}
        />
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell className="pt-6">
        <EmptyState
          icon="group"
          title="Sign in to join this shared budget"
          description="Use your account first, then this invite will open the shared workspace."
          action={{
            label: 'Sign in',
            onClick: () => navigate(`/login?redirect_after=${encodeURIComponent(location.pathname + location.search)}`),
          }}
        />
      </PageShell>
    );
  }

  if (acceptInviteMutation.isError) {
    return (
      <PageShell className="pt-6">
        <EmptyState
          icon="error"
          title="This invite link has expired or is invalid."
          description="Ask the group owner to send a fresh invite link."
          action={{ label: 'Go to profile', onClick: () => navigate('/profile') }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="pt-6">
      <div className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low px-5 py-8 text-center shadow-[var(--shadow-sm)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {acceptInviteMutation.isPending ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <UsersRound className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 text-[18px] font-semibold text-on-surface">
          {acceptInviteMutation.isPending ? 'Joining shared budget…' : 'Preparing your shared budget'}
        </h1>
        <p className="mt-2 text-[14px] leading-6 text-on-surface-variant">
          We’re checking the invite and syncing the shared group to this device.
        </p>
      </div>
    </PageShell>
  );
}
