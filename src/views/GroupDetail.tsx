import React, { useMemo, useState } from 'react';
import { ChevronLeft, Copy, Trash2, UserMinus, UserPlus, UsersRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import type { GroupBudgetInput, User } from '../types';
import { EmptyState, PageShell, UserAvatar, prettyCurrency, prettyDate } from '../components/shell';
import { useGroupExpensesQuery, useGroupMutations, useGroupsQuery } from '../hooks';

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { start, end };
}

export default function GroupDetail({
  currentUser,
}: {
  currentUser?: User | null;
}) {
  const navigate = useNavigate();
  const { groupId = '' } = useParams();
  const [inviteEmail, setInviteEmail] = useState('');
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const groupsQuery = useGroupsQuery(Boolean(currentUser));
  const group = groupsQuery.data?.find((item) => item.id === groupId) ?? null;
  const { start, end } = useMemo(() => monthRange(), []);
  const expensesQuery = useGroupExpensesQuery(groupId, start, end, Boolean(groupId && currentUser));
  const {
    inviteMemberMutation,
    removeMemberMutation,
    leaveGroupMutation,
    deleteGroupMutation,
    createGroupBudgetMutation,
    deleteGroupBudgetMutation,
  } = useGroupMutations();

  const isOwner = group?.members.some((member) => member.userId === currentUser?.id && member.role === 'owner') ?? false;

  if (!group) {
    return (
      <PageShell className="pt-6">
        <EmptyState
          icon="group"
          title="Shared budget not found"
          description="It may have been removed or you may no longer have access."
          action={{ label: 'Back to profile', onClick: () => navigate('/profile') }}
        />
      </PageShell>
    );
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    const invite = await inviteMemberMutation.mutateAsync({ groupId: group.id, email: inviteEmail });
    setInviteEmail('');
    if (invite.shareUrl && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(invite.shareUrl).catch(() => undefined);
    }
  };

  const handleCreateBudget = async () => {
    if (!budgetName.trim() || Number(budgetAmount) <= 0) return;
    const input: GroupBudgetInput = {
      groupId: group.id,
      name: budgetName.trim(),
      amount: Number(budgetAmount),
      currency: 'USD',
      period: 'monthly',
      categoryName: null,
    };
    await createGroupBudgetMutation.mutateAsync(input);
    setBudgetName('');
    setBudgetAmount('');
  };

  return (
    <PageShell className="pt-6">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/profile')} className="ui-icon-btn h-11 w-11">
            <ChevronLeft className="h-4 w-4 text-on-surface" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Shared budget</p>
            <h1 className="text-[24px] font-bold tracking-[-0.03em] text-on-surface">{group.name}</h1>
          </div>
        </div>

        <section className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Members</p>
              <p className="mt-1 text-[13px] text-on-surface-variant">Split budgets with family or housemates.</p>
            </div>
            <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary">
              {group.members.length}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {group.members.map((member) => (
              <div key={member.id} className="flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--bg-card)] px-3 py-2">
                <UserAvatar
                  user={{ name: member.name ?? member.email ?? 'Member', email: member.email ?? '', avatarUrl: member.avatarUrl ?? null }}
                  className="h-10 w-10 text-[12px]"
                  textClassName="text-[12px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">{member.name ?? member.email ?? 'Member'}</p>
                  <p className="truncate text-xs text-on-surface-variant">{member.email ?? 'Shared member'}</p>
                </div>
                {member.role === 'owner' ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Owner</span>
                ) : null}
                {isOwner && member.userId !== currentUser?.id ? (
                  <button
                    type="button"
                    onClick={() => void removeMemberMutation.mutateAsync({ groupId: group.id, userId: member.userId })}
                    className="ui-icon-btn h-10 w-10"
                    aria-label={`Remove ${member.name ?? member.email ?? 'member'}`}
                  >
                    <UserMinus className="h-4 w-4 text-error" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[var(--radius-sm)] border border-outline/10 bg-[var(--bg-card)] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              <UserPlus className="h-4 w-4" />
              Invite member
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@example.com"
                className="input-shell h-11 flex-1"
              />
              <button type="button" onClick={() => void handleInvite()} className="ui-btn ui-btn-primary h-11 sm:w-auto">
                <Copy className="h-4 w-4" />
                Copy invite link
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Budgets</p>
              <p className="mt-1 text-[13px] text-on-surface-variant">Track the shared budget targets for this group.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr,140px,auto]">
            <input value={budgetName} onChange={(event) => setBudgetName(event.target.value)} placeholder="Groceries" className="input-shell h-11" />
            <input value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} placeholder="500" className="input-shell h-11" inputMode="decimal" />
            <button type="button" onClick={() => void handleCreateBudget()} className="ui-btn ui-btn-primary h-11">
              Create
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {(group.budgets ?? []).length === 0 ? (
              <EmptyState
                icon="group"
                title="No group budgets yet"
                description="Create one so everyone can track shared spending together."
              />
            ) : (
              group.budgets?.map((budget) => {
                const progress = Math.min(100, (budget.spent / Math.max(budget.amount, 1)) * 100);
                return (
                  <div key={budget.id} className="rounded-[var(--radius-sm)] bg-[var(--bg-card)] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{budget.name}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">{prettyCurrency(budget.spent, budget.currency)} of {prettyCurrency(budget.amount, budget.currency)} spent</p>
                      </div>
                      <button type="button" onClick={() => void deleteGroupBudgetMutation.mutateAsync(budget.id)} className="ui-icon-btn h-10 w-10">
                        <Trash2 className="h-4 w-4 text-error" />
                      </button>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[var(--bg-elevated)]">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Recent shared expenses</p>
              <p className="mt-1 text-[13px] text-on-surface-variant">All member expenses tagged to this group.</p>
            </div>
            <UsersRound className="h-5 w-5 text-on-surface-variant" />
          </div>

          <div className="mt-4 space-y-3">
            {(expensesQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon="receipt"
                title="No shared expenses yet"
                description="Tag a transaction to this group and it will appear here for everyone."
              />
            ) : (
              expensesQuery.data?.map((expense) => {
                const member = group.members.find((item) => item.userId === expense.userId);
                return (
                  <motion.div
                    key={expense.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--bg-card)] px-3 py-3"
                  >
                    <UserAvatar
                      user={{ name: member?.name ?? member?.email ?? 'Member', email: member?.email ?? '', avatarUrl: member?.avatarUrl ?? null }}
                      className="h-10 w-10 text-[11px]"
                      textClassName="text-[11px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">{expense.description}</p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {member?.name ?? member?.email ?? 'Shared member'} · {prettyDate(expense.expenseDate)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-on-surface">{prettyCurrency(expense.amount, expense.currency)}</p>
                  </motion.div>
                );
              })
            )}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void leaveGroupMutation.mutateAsync(group.id)} className="ui-btn ui-btn-secondary h-11">
            Leave group
          </button>
          {isOwner ? (
            <button type="button" onClick={() => void deleteGroupMutation.mutateAsync(group.id).then(() => navigate('/profile'))} className="ui-btn h-11 bg-[var(--red)] text-white">
              Delete group
            </button>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
