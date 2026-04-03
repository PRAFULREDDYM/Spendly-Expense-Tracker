import type { CurrencyCode, ExpenseType } from './domain';

export type GroupRole = 'owner' | 'admin' | 'member';
export type GroupInviteStatus = 'active' | 'accepted' | 'revoked' | 'expired' | 'missing';

export interface Group {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  icon: string;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt: string;
  updatedAt: string;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  token: string;
  invitedBy: string;
  email: string | null;
  role: GroupRole;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupBudget {
  id: string;
  groupId: string;
  label: string;
  month: string;
  amount: number;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface GroupExpense {
  id: string;
  groupId: string;
  userId: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  expenseDate: string;
  type: ExpenseType;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  memberName: string;
  memberAvatarUrl: string | null;
}

export interface GroupSummary extends Group {
  memberCount: number;
  budgetCount: number;
  expenseCount: number;
  recentExpenseTotal: number;
}

export interface GroupDetail extends GroupSummary {
  currentUserRole: GroupRole | null;
  canManage: boolean;
  members: GroupMember[];
  budgets: GroupBudget[];
  recentExpenses: GroupExpense[];
  activeInvites: GroupInvite[];
}

export interface GroupCreateInput {
  name: string;
  description?: string | null;
  currency: CurrencyCode;
  icon?: string;
}

export interface GroupUpdateInput {
  name?: string;
  description?: string | null;
  currency?: CurrencyCode;
  icon?: string;
}

export interface GroupBudgetInput {
  label: string;
  month: string;
  amount: number;
  currency: CurrencyCode;
}

export interface GroupInviteInput {
  email?: string | null;
  role?: GroupRole;
  expiresAt?: string | null;
}

export interface GroupInvitePreview {
  status: GroupInviteStatus;
  message: string;
  group: Group | null;
  invite: GroupInvite | null;
  memberCount: number;
}
