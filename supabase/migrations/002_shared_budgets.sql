create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'users',
  currency text not null default 'USD',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists groups_owner_id_idx
  on public.groups (owner_id);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  role text not null default 'member',
  joined_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, user_id),
  constraint group_members_role_check check (role in ('owner', 'admin', 'member'))
);

create index if not exists group_members_user_id_idx
  on public.group_members (user_id, group_id);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_by uuid not null references auth.users (id) on delete cascade,
  email text,
  role text not null default 'member',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint group_invites_role_check check (role in ('owner', 'admin', 'member'))
);

create index if not exists group_invites_group_id_idx
  on public.group_invites (group_id, created_at desc);

create index if not exists group_invites_token_idx
  on public.group_invites (token);

create table if not exists public.group_budgets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  label text not null,
  month text not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists group_budgets_group_id_month_idx
  on public.group_budgets (group_id, month desc, created_at desc);

alter table public.expenses
  add column if not exists group_id uuid;

alter table public.expenses
  add constraint expenses_group_id_fkey
  foreign key (group_id) references public.groups (id) on delete set null;

create index if not exists expenses_group_id_expense_date_idx
  on public.expenses (group_id, expense_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_group_member(group_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_uuid
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(group_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_uuid
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_group_owner(group_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = group_uuid
      and g.owner_id = auth.uid()
  );
$$;

create or replace function public.create_group_with_owner(
  p_name text,
  p_description text default null,
  p_currency text default 'USD',
  p_icon text default 'users'
)
returns public.groups
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_name text;
  current_email text;
  current_avatar text;
  created_group public.groups%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(
      (select nullif(trim(name), '') from public.profiles where id = current_user_id),
      nullif(split_part(coalesce(auth.email(), ''), '@', 1), ''),
      'You'
    ),
    coalesce((select email from public.profiles where id = current_user_id), auth.email()),
    (select avatar_url from public.profiles where id = current_user_id)
  into current_name, current_email, current_avatar;

  insert into public.groups (owner_id, name, description, icon, currency)
  values (
    current_user_id,
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(nullif(trim(coalesce(p_icon, '')), ''), 'users'),
    coalesce(nullif(trim(coalesce(p_currency, '')), ''), 'USD')
  )
  returning * into created_group;

  insert into public.group_members (group_id, user_id, display_name, email, avatar_url, role)
  values (
    created_group.id,
    current_user_id,
    current_name,
    current_email,
    current_avatar,
    'owner'
  );

  return created_group;
end;
$$;

create or replace function public.preview_group_invite(invite_token text)
returns table (
  invite_id uuid,
  group_id uuid,
  group_name text,
  group_description text,
  group_currency text,
  invite_role text,
  invited_email text,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  member_count bigint
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    i.id as invite_id,
    g.id as group_id,
    g.name as group_name,
    g.description as group_description,
    g.currency as group_currency,
    i.role as invite_role,
    i.email as invited_email,
    i.accepted_at,
    i.revoked_at,
    i.expires_at,
    i.created_at,
    (
      select count(*)::bigint
      from public.group_members gm
      where gm.group_id = g.id
    ) as member_count
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.token = invite_token
  limit 1;
$$;

create or replace function public.accept_group_invite(invite_token text)
returns public.groups
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  invite_row public.group_invites%rowtype;
  created_group public.groups%rowtype;
  current_name text;
  current_email text;
  current_avatar text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into invite_row
  from public.group_invites
  where token = invite_token
  limit 1
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if invite_row.revoked_at is not null then
    raise exception 'Invite revoked';
  end if;

  if invite_row.accepted_at is not null then
    raise exception 'Invite already accepted';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at < timezone('utc', now()) then
    raise exception 'Invite expired';
  end if;

  select
    coalesce(
      (select nullif(trim(name), '') from public.profiles where id = current_user_id),
      nullif(split_part(coalesce(auth.email(), ''), '@', 1), ''),
      'You'
    ),
    coalesce((select email from public.profiles where id = current_user_id), auth.email()),
    (select avatar_url from public.profiles where id = current_user_id)
  into current_name, current_email, current_avatar;

  insert into public.group_members (group_id, user_id, display_name, email, avatar_url, role)
  values (
    invite_row.group_id,
    current_user_id,
    current_name,
    current_email,
    current_avatar,
    coalesce(invite_row.role, 'member')
  )
  on conflict (group_id, user_id)
  do update set
    display_name = excluded.display_name,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    role = excluded.role,
    updated_at = timezone('utc', now());

  update public.group_invites
  set accepted_at = timezone('utc', now()),
      accepted_by = current_user_id
  where id = invite_row.id;

  select *
  into created_group
  from public.groups
  where id = invite_row.group_id;

  return created_group;
end;
$$;

revoke all on function public.create_group_with_owner(text, text, text, text) from public;
revoke all on function public.preview_group_invite(text) from public;
revoke all on function public.accept_group_invite(text) from public;

grant execute on function public.create_group_with_owner(text, text, text, text) to authenticated;
grant execute on function public.preview_group_invite(text) to anon, authenticated;
grant execute on function public.accept_group_invite(text) to authenticated;

drop trigger if exists set_groups_updated_at on public.groups;
create trigger set_groups_updated_at
before update on public.groups
for each row execute procedure public.set_updated_at();

drop trigger if exists set_group_members_updated_at on public.group_members;
create trigger set_group_members_updated_at
before update on public.group_members
for each row execute procedure public.set_updated_at();

drop trigger if exists set_group_invites_updated_at on public.group_invites;
create trigger set_group_invites_updated_at
before update on public.group_invites
for each row execute procedure public.set_updated_at();

drop trigger if exists set_group_budgets_updated_at on public.group_budgets;
create trigger set_group_budgets_updated_at
before update on public.group_budgets
for each row execute procedure public.set_updated_at();

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_budgets enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member"
on public.groups for select
using (public.is_group_member(id) or owner_id = auth.uid());

drop policy if exists "groups_insert_owner" on public.groups;
create policy "groups_insert_owner"
on public.groups for insert
with check (owner_id = auth.uid());

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner"
on public.groups for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner"
on public.groups for delete
using (owner_id = auth.uid());

drop policy if exists "group_members_select_member" on public.group_members;
create policy "group_members_select_member"
on public.group_members for select
using (public.is_group_member(group_id) or auth.uid() = user_id);

drop policy if exists "group_members_insert_admin" on public.group_members;
create policy "group_members_insert_admin"
on public.group_members for insert
with check (
  auth.uid() = user_id
  and (
    public.is_group_owner(group_id)
    or public.is_group_admin(group_id)
  )
);

drop policy if exists "group_members_update_admin" on public.group_members;
create policy "group_members_update_admin"
on public.group_members for update
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "group_members_delete_self_or_admin" on public.group_members;
create policy "group_members_delete_self_or_admin"
on public.group_members for delete
using (auth.uid() = user_id or public.is_group_admin(group_id));

drop policy if exists "group_invites_select_member" on public.group_invites;
create policy "group_invites_select_member"
on public.group_invites for select
using (public.is_group_member(group_id));

drop policy if exists "group_invites_insert_admin" on public.group_invites;
create policy "group_invites_insert_admin"
on public.group_invites for insert
with check (public.is_group_admin(group_id));

drop policy if exists "group_invites_update_admin" on public.group_invites;
create policy "group_invites_update_admin"
on public.group_invites for update
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "group_invites_delete_admin" on public.group_invites;
create policy "group_invites_delete_admin"
on public.group_invites for delete
using (public.is_group_admin(group_id));

drop policy if exists "group_budgets_select_member" on public.group_budgets;
create policy "group_budgets_select_member"
on public.group_budgets for select
using (public.is_group_member(group_id));

drop policy if exists "group_budgets_insert_admin" on public.group_budgets;
create policy "group_budgets_insert_admin"
on public.group_budgets for insert
with check (public.is_group_admin(group_id));

drop policy if exists "group_budgets_update_admin" on public.group_budgets;
create policy "group_budgets_update_admin"
on public.group_budgets for update
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "group_budgets_delete_admin" on public.group_budgets;
create policy "group_budgets_delete_admin"
on public.group_budgets for delete
using (public.is_group_admin(group_id));

drop policy if exists "expenses_select_own_or_group" on public.expenses;
create policy "expenses_select_own_or_group"
on public.expenses for select
using (auth.uid() = user_id or public.is_group_member(group_id));

drop policy if exists "expenses_insert_own_or_group" on public.expenses;
create policy "expenses_insert_own_or_group"
on public.expenses for insert
with check (
  auth.uid() = user_id
  and (
    group_id is null
    or public.is_group_member(group_id)
  )
);

drop policy if exists "expenses_update_own_or_group_admin" on public.expenses;
create policy "expenses_update_own_or_group_admin"
on public.expenses for update
using (auth.uid() = user_id or public.is_group_admin(group_id))
with check (auth.uid() = user_id or public.is_group_admin(group_id));

drop policy if exists "expenses_delete_own_or_group_admin" on public.expenses;
create policy "expenses_delete_own_or_group_admin"
on public.expenses for delete
using (auth.uid() = user_id or public.is_group_admin(group_id));

