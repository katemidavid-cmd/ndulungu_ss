-- Migration: Madarasa (Form I - Form IV), mikondo na wanafunzi
-- Endesha hii kwenye SQL Editor ya Supabase au kwa scripts/run-sql.ps1

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
