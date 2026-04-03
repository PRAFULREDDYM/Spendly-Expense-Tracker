import type { AuthPayload } from '../types/api';
import type { AuthSession, UserPreferences } from '../types/domain';
import { supabaseStore } from '../services/supabaseStore';

export async function signIn(input: AuthPayload) {
  return supabaseStore.login(input);
}

export async function signUp(input: AuthPayload) {
  return supabaseStore.signUp(input);
}

export async function refreshSession() {
  return supabaseStore.refresh();
}

export async function fetchSession() {
  return supabaseStore.me();
}

export async function logoutSession() {
  await supabaseStore.logout();
}

export async function updatePreferences(preferences: UserPreferences) {
  await supabaseStore.updatePreferences(preferences);
  const session = await supabaseStore.me();
  if (!session) {
    throw new Error('No active synced session.');
  }
  return session;
}

export async function bootstrapSession(): Promise<AuthSession | null> {
  return supabaseStore.me();
}

export function isAuthHttpError(_error: unknown): _error is Error {
  return false;
}
