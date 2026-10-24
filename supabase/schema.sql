-- Schema ya mfumo wa shule (Supabase/Postgres)
-- Tumia kwenye SQL Editor ya Supabase

create extension if not exists "uuid-ossp";

create type user_role as enum ('headmaster','academic','teacher');
create type user_sex as enum ('M','F');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  middle_name text,
  last_name text not null,
  full_name text generated always as (trim(coalesce(first_name,'') || ' ' || coalesce(middle_name,'') || ' ' || coalesce(last_name,''))) stored,
  sex user_sex not null,
  phone text,
  email text,
  role user_role not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.teaching_assignments (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_name text not null,
  subject_name text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.teaching_assignments enable row level security;

-- Policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can view their own assignments"
  on public.teaching_assignments for select
  using (auth.uid() = teacher_id);

-- Auto-create profile on signup (optional helper)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Insert tupu - itajazwa na admin kupitia service role au insert moja kwa moja
  return new;
end;
$$ language plpgsql security definer;

-- Note: Kwa kuunda watumiaji, tumia Supabase Auth (Admin API/Service role) ili kuunda user
-- kisha weka rekodi kwenye profiles na teaching_assignments.

-- ============================================================
-- Madarasa (Form I - Form IV), mikondo na wanafunzi
-- ============================================================

create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  form text not null check (form in ('Form I','Form II','Form III','Form IV')),
  stream text not null,
  created_at timestamptz not null default now(),
  constraint classes_form_stream_key unique (form, stream)
);

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  first_name text not null,
  middle_name text,
  last_name text not null,
  full_name text generated always as (trim(coalesce(first_name,'') || ' ' || coalesce(middle_name,'') || ' ' || coalesce(last_name,''))) stored,
  sex user_sex not null,
  admission_no text,
  created_at timestamptz not null default now()
);

create unique index if not exists students_admission_no_key
  on public.students (admission_no)
  where admission_no is not null;

create index if not exists students_class_id_idx on public.students (class_id);

alter table public.classes enable row level security;
alter table public.students enable row level security;

create or replace function public.can_manage_classes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('headmaster','academic')
  );
$$;

drop policy if exists "Classes are viewable by authenticated users" on public.classes;
drop policy if exists "Classes can be managed by headmaster and academic" on public.classes;
drop policy if exists "Students are viewable by authenticated users" on public.students;
drop policy if exists "Students can be managed by headmaster and academic" on public.students;

create policy "Classes are viewable by authenticated users"
  on public.classes for select
  using (auth.uid() is not null);

create policy "Classes can be managed by headmaster and academic"
  on public.classes for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

create policy "Students are viewable by authenticated users"
  on public.students for select
  using (auth.uid() is not null);

create policy "Students can be managed by headmaster and academic"
  on public.students for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant execute on function public.can_manage_classes() to authenticated;

-- ============================================================
-- Masomo (Subjects)
-- ============================================================

create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  subject_code text,
  has_practical boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.subjects
  add column if not exists subject_code text;

update public.subjects
set subject_code =
  upper(coalesce(nullif(left(regexp_replace(name, '[^A-Za-z0-9]+', '', 'g'), 8), ''), 'SUB'))
  || '-' || upper(left(replace(id::text, '-', ''), 6))
where subject_code is null or btrim(subject_code) = '';

alter table public.subjects
  alter column subject_code set not null;

create unique index if not exists subjects_subject_code_key
  on public.subjects (upper(subject_code));

alter table public.subjects enable row level security;

drop policy if exists "Subjects are viewable by authenticated users" on public.subjects;
drop policy if exists "Subjects can be managed by headmaster and academic" on public.subjects;

create policy "Subjects are viewable by authenticated users"
  on public.subjects for select
  using (auth.uid() is not null);

create policy "Subjects can be managed by headmaster and academic"
  on public.subjects for all
  using (public.can_manage_classes())
  with check (public.can_manage_classes());

grant select, insert, update, delete on public.subjects to authenticated;
