# Supabase Setup Guide

To migrate this application to Supabase, follow these steps:

## 1. Create a New Project
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Note down your **Project URL** and **Anon Key** from the Project Settings -> API tab.
3. Add these to your `.env` (or Render Dashboard) as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 2. Enable pgvector (For Face Recognition)
1. In your Supabase Dashboard, go to **Database** -> **Extensions**.
2. Search for `vector` and enable it.

## 3. Run the Database Schema
Go to the **SQL Editor** in Supabase and run the following script:

```sql
-- ENABLE VECTOR EXTENSION
create extension if not exists vector;

-- PUBLIC PROFILES (For Admin/User roles)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text unique,
  display_name text,
  role text check (role in ('admin', 'staff')) default 'staff',
  staff_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- STAFF TABLE
create table public.staff (
  id uuid default gen_random_uuid() primary key,
  staff_id text unique not null, -- Human readable like 'S-001'
  full_name text not null,
  phone_number text,
  email text unique,
  role text,
  joining_date date default current_date,
  salary_type text check (salary_type in ('Monthly', 'Daily', 'Hourly')),
  salary_amount numeric,
  work_shift text,
  is_admin boolean default false,
  pin text, -- For attendance tracking without login
  password text, -- Added for direct login with Staff ID
  face_embedding vector(128), -- For matching face math (128 dimensions)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ATTENDANCE TABLE
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  staff_id text references public.staff(staff_id),
  staff_name text,
  date date not null,
  status text check (status in ('Present', 'Absent', 'Half Day', 'Leave')),
  check_in time,
  check_out time,
  notes text,
  ai_verified boolean default false,
  face_match_score numeric,
  overtime_minutes integer default 0,
  last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- SHIFTS
create table public.shifts (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  start_time time not null,
  end_time time not null,
  min_hours_for_full_day numeric default 8
);

-- LEAVES
create table public.leaves (
  id uuid default gen_random_uuid() primary key,
  staff_id text,
  staff_name text,
  leave_type text,
  start_date date not null,
  end_date date not null,
  reason text,
  status text check (status in ('Pending', 'Approved', 'Rejected')) default 'Pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- PAYROLL
create table public.payroll (
  id uuid default gen_random_uuid() primary key,
  staff_id text,
  staff_name text,
  month text,
  basic_salary numeric,
  attendance_deduction numeric default 0,
  overtime_bonus numeric default 0,
  total_salary numeric,
  status text check (status in ('Unpaid', 'Paid')) default 'Unpaid',
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- SETTINGS (For global config like announcements)
create table public.settings (
  id text primary key,
  value jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  message text not null,
  type text,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- QR SESSIONS (For Dynamic Attendance QR)
create table public.qr_sessions (
  id text primary key, -- e.g., 'active_session'
  token text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- SECURITY RULES (Row Level Security)
-- For now, allow everything to get started
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

alter table public.staff enable row level security;
create policy "Everyone can view staff" on public.staff for select using (true);
create policy "Admins can manage staff" on public.staff for all using (true);

alter table public.attendance enable row level security;
create policy "Anyone can manage attendance" on public.attendance for all using (true);

alter table public.leaves enable row level security;
create policy "Anyone can manage leaves" on public.leaves for all using (true);

alter table public.payroll enable row level security;
create policy "Anyone can manage payroll" on public.payroll for all using (true);

alter table public.notifications enable row level security;
create policy "Users can manage their own notifications" on public.notifications for all using (auth.uid() = user_id);

alter table public.shifts enable row level security;
create policy "Everyone can view shifts" on public.shifts for select using (true);

alter table public.qr_sessions enable row level security;
create policy "Everyone can view QR sessions" on public.qr_sessions for select using (true);
create policy "Admins can manage QR sessions" on public.qr_sessions for all using (true);

alter table public.settings enable row level security;
create policy "Everyone can view settings" on public.settings for select using (true);

-- Enable Realtime for all tables
alter publication supabase_realtime add table public.staff;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.leaves;
alter publication supabase_realtime add table public.payroll;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.qr_sessions;
```

## 4. Auth Configuration
In the **Authentication** -> **Providers** tab:
1. Enable **Email** provider.
2. Disable "Confirm Email" if you want to create staff members quickly without them needing to check their email.
3. Keep Google as an option or remove it as you prefer.
