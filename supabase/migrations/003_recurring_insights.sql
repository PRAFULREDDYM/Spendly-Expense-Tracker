create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  category_id uuid references public.categories (id) on delete set null,
  frequency text not null,
  day_of_month integer,
  day_of_week integer,
  next_due date not null,
  last_paid date,
  active boolean not null default true,
  auto_log boolean not null default false,
  reminder_days_before integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recurring_expense_id uuid not null references public.recurring_expenses (id) on delete cascade,
  due_date date not null,
  reminded_at timestamptz not null default timezone('utc', now()),
  dismissed boolean not null default false,
  logged boolean not null default false
);

create index if not exists recurring_expenses_user_id_next_due_idx
  on public.recurring_expenses (user_id, next_due);

create index if not exists reminders_user_id_due_date_idx
  on public.reminders (user_id, due_date desc);

alter table public.recurring_expenses enable row level security;
alter table public.reminders enable row level security;

drop policy if exists "user owns recurring" on public.recurring_expenses;
create policy "user owns recurring"
on public.recurring_expenses for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user owns reminders" on public.reminders;
create policy "user owns reminders"
on public.reminders for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
