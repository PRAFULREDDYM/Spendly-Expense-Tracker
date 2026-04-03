import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  Group,
  GroupBudget,
  GroupBudgetInput,
  GroupCreateInput,
  GroupDetail,
  GroupExpense,
  GroupInvite,
  GroupInviteInput,
  GroupInvitePreview,
  GroupInviteStatus,
  GroupMember,
  GroupRole,
  GroupSummary,
  GroupUpdateInput,
} from '../types/groups';

type GroupRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  icon: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  role: GroupRole;
  joined_at: string;
  updated_at: string;
};

type GroupInviteRow = {
  id: string;
  group_id: string;
  token: string;
  invited_by: string;
  email: string | null;
  role: GroupRole;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type GroupBudgetRow = {
  id: string;
  group_id: string;
  label: string;
  month: string;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

type GroupExpenseRow = {
  id: string;
  group_id: string | null;
  user_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  expense_date: string;
  description: string;
  type: string;
  created_at: string;
  updated_at: string;
};

type GroupInvitePreviewRow = {
  invite_id: string;
  group_id: string;
  group_name: string;
  group_description: string | null;
  group_currency: string;
  invite_role: GroupRole;
  invited_email: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  member_count: number | string | null;
};

type CurrentUser = {
  userId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
};

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function parseCurrency(value: string | null | undefined): Group['currency'] {
  return (value?.trim() || 'USD') as Group['currency'];
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    currency: parseCurrency(row.currency),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: GroupMemberRow): GroupMember {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
}

function mapInvite(row: GroupInviteRow, token = row.token): GroupInvite {
  return {
    id: row.id,
    groupId: row.group_id,
    token,
    invitedBy: row.invited_by,
    email: row.email,
    role: row.role,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBudget(row: GroupBudgetRow): GroupBudget {
  return {
    id: row.id,
    groupId: row.group_id,
    label: row.label,
    month: row.month,
    amount: Number(row.amount),
    currency: parseCurrency(row.currency),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExpense(row: GroupExpenseRow, member: GroupMember | undefined): GroupExpense {
  return {
    id: row.id,
    groupId: row.group_id ?? '',
    userId: row.user_id,
    categoryId: row.category_id,
    amount: Number(row.amount),
    currency: parseCurrency(row.currency),
    expenseDate: row.expense_date,
    description: row.description,
    type: row.type === 'income' ? 'income' : 'expense',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberName: member?.displayName ?? 'Member',
    memberAvatarUrl: member?.avatarUrl ?? null,
  };
}

function inviteStatus(invite: GroupInvite | null): GroupInviteStatus {
  if (!invite) return 'missing';
  if (invite.revokedAt) return 'revoked';
  if (invite.acceptedAt) return 'accepted';
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) return 'expired';
  return 'active';
}

async function requireCurrentUser(): Promise<CurrentUser> {
  assertSupabaseConfigured();
  const { data: sessionData, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = sessionData.session;
  if (!session) {
    throw new Error('Sign in to manage shared budgets.');
  }

  const userId = session.user.id;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,name,avatar_url')
    .eq('id', userId)
    .maybeSingle<{ id: string; email: string | null; name: string | null; avatar_url: string | null }>();
  if (profileError) throw profileError;

  return {
    userId,
    email: profile?.email ?? session.user.email ?? null,
    name:
      profile?.name?.trim()
      || (typeof session.user.user_metadata?.name === 'string' && session.user.user_metadata.name.trim())
      || session.user.email?.split('@')[0]
      || 'You',
    avatarUrl:
      profile?.avatar_url
      ?? (typeof session.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : null),
  };
}

async function requireCurrentUserId() {
  const user = await requireCurrentUser();
  return user.userId;
}

async function getCurrentMembership(groupId: string) {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id,user_id,display_name,email,avatar_url,role,joined_at,updated_at')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle<GroupMemberRow>();
  if (error) throw error;
  const member = data ? mapMember(data) : null;
  return {
    member,
    userId,
    canManage: Boolean(member && (member.role === 'owner' || member.role === 'admin')),
    isOwner: member?.role === 'owner',
  };
}

async function assertCanManageGroup(groupId: string) {
  const membership = await getCurrentMembership(groupId);
  if (!membership.canManage) {
    throw new Error('You do not have permission to manage this group.');
  }
  return membership;
}

async function assertGroupOwner(groupId: string) {
  const membership = await getCurrentMembership(groupId);
  if (!membership.isOwner) {
    throw new Error('Only the group owner can delete this group.');
  }
  return membership;
}

async function leaveGroupInternal(groupId: string) {
  const membership = await getCurrentMembership(groupId);
  if (!membership.member) {
    throw new Error('You are not a member of this group.');
  }
  if (membership.isOwner) {
    throw new Error('Transfer ownership or delete the group before leaving.');
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', membership.member.userId);
  if (error) throw error;
}

async function fetchGroup(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('id,owner_id,name,description,icon,currency,created_at,updated_at')
    .eq('id', groupId)
    .maybeSingle<GroupRow>();
  if (error) throw error;
  if (!data) throw new Error('Group not found.');
  return mapGroup(data);
}

async function fetchMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id,user_id,display_name,email,avatar_url,role,joined_at,updated_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
    .returns<GroupMemberRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapMember);
}

async function fetchBudgets(groupId: string): Promise<GroupBudget[]> {
  const { data, error } = await supabase
    .from('group_budgets')
    .select('id,group_id,label,month,amount,currency,created_at,updated_at')
    .eq('group_id', groupId)
    .order('month', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<GroupBudgetRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapBudget);
}

async function fetchInvites(groupId: string): Promise<GroupInvite[]> {
  const { data, error } = await supabase
    .from('group_invites')
    .select('id,group_id,token,invited_by,email,role,accepted_at,accepted_by,revoked_at,expires_at,created_at,updated_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .returns<GroupInviteRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => mapInvite(row));
}

async function fetchExpenses(groupId: string, limit = 8): Promise<GroupExpense[]> {
  const [expenseResponse, memberResponse] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,group_id,user_id,category_id,amount,currency,expense_date,description,type,created_at,updated_at')
      .eq('group_id', groupId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<GroupExpenseRow[]>(),
    supabase
      .from('group_members')
      .select('group_id,user_id,display_name,email,avatar_url,role,joined_at,updated_at')
      .eq('group_id', groupId)
      .returns<GroupMemberRow[]>(),
  ]);

  if (expenseResponse.error) throw expenseResponse.error;
  if (memberResponse.error) throw memberResponse.error;

  const memberMap = new Map((memberResponse.data ?? []).map((row) => {
    const member = mapMember(row);
    return [member.userId, member] as const;
  }));

  return (expenseResponse.data ?? []).map((row) => mapExpense(row, memberMap.get(row.user_id)));
}

function buildSummary(group: Group, members: GroupMember[], budgets: GroupBudget[], expenses: GroupExpense[]): GroupSummary {
  return {
    ...group,
    memberCount: members.length,
    budgetCount: budgets.length,
    expenseCount: expenses.length,
    recentExpenseTotal: expenses.reduce((sum, expense) => sum + expense.amount, 0),
  };
}

async function listVisibleGroupIds(userId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .returns<Array<{ group_id: string }>>();
  if (error) throw error;
  return (data ?? []).map((row) => row.group_id);
}

async function listGroupSummaries(groupIds: string[]): Promise<GroupSummary[]> {
  if (!groupIds.length) return [];

  const [groupsResponse, membersResponse, budgetsResponse, expensesResponse] = await Promise.all([
    supabase
      .from('groups')
      .select('id,owner_id,name,description,icon,currency,created_at,updated_at')
      .in('id', groupIds)
      .returns<GroupRow[]>(),
    supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)
      .returns<Array<{ group_id: string }>>(),
    supabase
      .from('group_budgets')
      .select('group_id')
      .in('group_id', groupIds)
      .returns<Array<{ group_id: string }>>(),
    supabase
      .from('expenses')
      .select('group_id,amount')
      .in('group_id', groupIds)
      .returns<Array<{ group_id: string | null; amount: number }>>(),
  ]);

  if (groupsResponse.error) throw groupsResponse.error;
  if (membersResponse.error) throw membersResponse.error;
  if (budgetsResponse.error) throw budgetsResponse.error;
  if (expensesResponse.error) throw expensesResponse.error;

  const memberCountMap = new Map<string, number>();
  const budgetCountMap = new Map<string, number>();
  const expenseCountMap = new Map<string, number>();
  const expenseTotalMap = new Map<string, number>();

  for (const row of membersResponse.data ?? []) {
    memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) ?? 0) + 1);
  }
  for (const row of budgetsResponse.data ?? []) {
    budgetCountMap.set(row.group_id, (budgetCountMap.get(row.group_id) ?? 0) + 1);
  }
  for (const row of expensesResponse.data ?? []) {
    if (!row.group_id) continue;
    expenseCountMap.set(row.group_id, (expenseCountMap.get(row.group_id) ?? 0) + 1);
    expenseTotalMap.set(row.group_id, (expenseTotalMap.get(row.group_id) ?? 0) + Number(row.amount ?? 0));
  }

  return (groupsResponse.data ?? []).map((row) => {
    const group = mapGroup(row);
    return {
      ...group,
      memberCount: memberCountMap.get(group.id) ?? 0,
      budgetCount: budgetCountMap.get(group.id) ?? 0,
      expenseCount: expenseCountMap.get(group.id) ?? 0,
      recentExpenseTotal: expenseTotalMap.get(group.id) ?? 0,
    };
  });
}

export function buildGroupInviteUrl(token: string, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const normalizedOrigin = origin.replace(/\/$/, '');
  return `${normalizedOrigin}/invite?token=${encodeURIComponent(token)}`;
}

async function getGroupInvitePreview(token: string): Promise<GroupInvitePreview> {
  assertSupabaseConfigured();
  const trimmed = token.trim();
  if (!trimmed) {
    return {
      status: 'missing',
      message: 'This invite link is missing a token.',
      group: null,
      invite: null,
      memberCount: 0,
    };
  }

  const { data, error } = await supabase.rpc('preview_group_invite', {
    invite_token: trimmed,
  });
  if (error) {
    if (error.message.toLowerCase().includes('not found')) {
      return {
        status: 'missing',
        message: 'This invite could not be found.',
        group: null,
        invite: null,
        memberCount: 0,
      };
    }
    throw error;
  }

  const row = firstRow<GroupInvitePreviewRow>(data as GroupInvitePreviewRow | GroupInvitePreviewRow[] | null);
  if (!row) {
    return {
      status: 'missing',
      message: 'This invite could not be found.',
      group: null,
      invite: null,
      memberCount: 0,
    };
  }

  const invite: GroupInvite = {
    id: row.invite_id,
    groupId: row.group_id,
    token: trimmed,
    invitedBy: '',
    email: row.invited_email,
    role: row.invite_role,
    acceptedAt: row.accepted_at,
    acceptedBy: null,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };

  const group: Group = {
    id: row.group_id,
    ownerId: '',
    name: row.group_name,
    description: row.group_description,
    icon: 'users',
    currency: parseCurrency(row.group_currency),
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };

  const status = inviteStatus(invite);
  return {
    status,
    message:
      status === 'active'
        ? `You have been invited to join ${group.name}.`
        : status === 'accepted'
          ? 'This invite has already been accepted.'
          : status === 'revoked'
            ? 'This invite has been revoked.'
            : status === 'expired'
              ? 'This invite has expired.'
              : 'This invite could not be found.',
    group,
    invite,
    memberCount: Number(row.member_count ?? 0),
  };
}

export const groupsStore = {
  async listGroups(): Promise<GroupSummary[]> {
    const userId = await requireCurrentUserId();
    const groupIds = await listVisibleGroupIds(userId);
    return listGroupSummaries(groupIds);
  },

  async getGroup(groupId: string): Promise<Group> {
    await requireCurrentUserId();
    return fetchGroup(groupId);
  },

  async getGroupDetail(groupId: string): Promise<GroupDetail> {
    const group = await fetchGroup(groupId);
    const [membership, members, budgets, recentExpenses, activeInvites] = await Promise.all([
      getCurrentMembership(groupId),
      fetchMembers(groupId),
      fetchBudgets(groupId),
      fetchExpenses(groupId, 8),
      fetchInvites(groupId).then((invites) =>
        invites.filter((invite) => inviteStatus(invite) === 'active'),
      ),
    ]);

    return {
      ...buildSummary(group, members, budgets, recentExpenses),
      currentUserRole: membership.member?.role ?? null,
      canManage: membership.canManage,
      members,
      budgets,
      recentExpenses,
      activeInvites,
    };
  },

  async createGroup(input: GroupCreateInput): Promise<Group> {
    await requireCurrentUserId();
    const { data, error } = await supabase.rpc('create_group_with_owner', {
      p_name: input.name.trim(),
      p_description: input.description?.trim() ? input.description.trim() : null,
      p_currency: input.currency,
      p_icon: input.icon?.trim() || 'users',
    });
    if (error) throw error;
    const row = firstRow<GroupRow>(data as GroupRow | GroupRow[] | null);
    if (!row) throw new Error('Could not create this group.');
    return mapGroup(row);
  },

  async updateGroup(groupId: string, input: GroupUpdateInput): Promise<Group> {
    await assertCanManageGroup(groupId);
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description?.trim() ? input.description.trim() : null;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.icon !== undefined) patch.icon = input.icon.trim();

    const { data, error } = await supabase
      .from('groups')
      .update(patch)
      .eq('id', groupId)
      .select('id,owner_id,name,description,icon,currency,created_at,updated_at')
      .maybeSingle<GroupRow>();
    if (error) throw error;
    if (!data) throw new Error('Group not found.');
    return mapGroup(data);
  },

  async deleteGroup(groupId: string): Promise<void> {
    await assertGroupOwner(groupId);
    const { error } = await supabase.from('groups').delete().eq('id', groupId);
    if (error) throw error;
  },

  async listMembers(groupId: string): Promise<GroupMember[]> {
    await fetchGroup(groupId);
    return fetchMembers(groupId);
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    const membership = await getCurrentMembership(groupId);
    if (!membership.member) {
      throw new Error('You are not a member of this group.');
    }

    if (membership.member.userId === userId) {
      if (membership.isOwner) {
        throw new Error('Transfer ownership or delete the group before leaving.');
      }
      await leaveGroupInternal(groupId);
      return;
    }

    if (!membership.canManage) {
      throw new Error('You do not have permission to remove members.');
    }

    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
  },

  async leaveGroup(groupId: string): Promise<void> {
    await leaveGroupInternal(groupId);
  },

  async listBudgets(groupId: string): Promise<GroupBudget[]> {
    await fetchGroup(groupId);
    return fetchBudgets(groupId);
  },

  async createBudget(groupId: string, input: GroupBudgetInput): Promise<GroupBudget> {
    await assertCanManageGroup(groupId);
    const { data, error } = await supabase
      .from('group_budgets')
      .insert({
        group_id: groupId,
        label: input.label.trim(),
        month: input.month,
        amount: input.amount,
        currency: input.currency,
      })
      .select('id,group_id,label,month,amount,currency,created_at,updated_at')
      .maybeSingle<GroupBudgetRow>();
    if (error) throw error;
    if (!data) throw new Error('Could not create this budget.');
    return mapBudget(data);
  },

  async updateBudget(groupId: string, budgetId: string, input: GroupBudgetInput): Promise<GroupBudget> {
    await assertCanManageGroup(groupId);
    const { data, error } = await supabase
      .from('group_budgets')
      .update({
        label: input.label.trim(),
        month: input.month,
        amount: input.amount,
        currency: input.currency,
      })
      .eq('group_id', groupId)
      .eq('id', budgetId)
      .select('id,group_id,label,month,amount,currency,created_at,updated_at')
      .maybeSingle<GroupBudgetRow>();
    if (error) throw error;
    if (!data) throw new Error('Budget not found.');
    return mapBudget(data);
  },

  async deleteBudget(groupId: string, budgetId: string): Promise<void> {
    await assertCanManageGroup(groupId);
    const { error } = await supabase.from('group_budgets').delete().eq('group_id', groupId).eq('id', budgetId);
    if (error) throw error;
  },

  async listRecentExpenses(groupId: string, limit = 8): Promise<GroupExpense[]> {
    await fetchGroup(groupId);
    return fetchExpenses(groupId, limit);
  },

  async listActiveInvites(groupId: string): Promise<GroupInvite[]> {
    await fetchGroup(groupId);
    const invites = await fetchInvites(groupId);
    return invites.filter((invite) => inviteStatus(invite) === 'active');
  },

  async createInvite(groupId: string, input: GroupInviteInput = {}): Promise<GroupInvite> {
    await assertCanManageGroup(groupId);
    const existing = await listActiveInvites(groupId);
    if (existing.length) {
      return existing[0];
    }

    const currentUser = await requireCurrentUser();
    const { data, error } = await supabase
      .from('group_invites')
      .insert({
        group_id: groupId,
        invited_by: currentUser.userId,
        email: input.email ?? null,
        role: input.role ?? 'member',
        expires_at: input.expiresAt ?? null,
      })
      .select('id,group_id,token,invited_by,email,role,accepted_at,accepted_by,revoked_at,expires_at,created_at,updated_at')
      .maybeSingle<GroupInviteRow>();
    if (error) throw error;
    if (!data) throw new Error('Could not create this invite.');
    return mapInvite(data);
  },

  async revokeInvite(groupId: string, inviteId: string): Promise<void> {
    await assertCanManageGroup(groupId);
    const { error } = await supabase
      .from('group_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('id', inviteId);
    if (error) throw error;
  },

  async previewInvite(token: string): Promise<GroupInvitePreview> {
    return getGroupInvitePreview(token);
  },

  async acceptInvite(token: string): Promise<Group> {
    await requireCurrentUser();
    const { data, error } = await supabase.rpc('accept_group_invite', {
      invite_token: token.trim(),
    });
    if (error) throw error;
    const row = firstRow<GroupRow>(data as GroupRow | GroupRow[] | null);
    if (!row) throw new Error('Could not accept this invite.');
    return mapGroup(row);
  },

  buildInviteUrl: buildGroupInviteUrl,
};

async function listActiveInvites(groupId: string) {
  const invites = await fetchInvites(groupId);
  return invites.filter((invite) => inviteStatus(invite) === 'active');
}
