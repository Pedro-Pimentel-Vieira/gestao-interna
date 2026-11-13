-- Execute no SQL Editor do seu projeto Supabase.
begin;

create table if not exists public.member_profiles (
  id text primary key check (id ~ '^[a-f0-9]{20}$'),
  name text not null check (char_length(name) between 1 and 160),
  role text not null default '' check (char_length(role) <= 100),
  email text not null default '' check (char_length(email) <= 200),
  phone text not null default '' check (char_length(phone) <= 40),
  bio text not null default '' check (char_length(bio) <= 3000),
  attendance numeric(5,2) check (attendance between 0 and 100),
  photo_path text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key check (id ~ '^[a-f0-9]{20}$'),
  name text not null,
  description text not null default '',
  responsible_id text references public.member_profiles(id) on delete set null,
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;
alter table public.projects enable row level security;
revoke all on public.member_profiles, public.projects from anon, authenticated;
grant select, insert, update, delete on public.member_profiles, public.projects to service_role;

create or replace function public.gestao_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists member_profiles_updated_at on public.member_profiles;
create trigger member_profiles_updated_at before update on public.member_profiles
for each row execute function public.gestao_set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
for each row execute function public.gestao_set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;
commit;
