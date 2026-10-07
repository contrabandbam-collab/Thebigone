-- ShortStack foundation schema. Review and apply in a non-production Supabase project first.
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(gen_random_bytes(8), 'hex'),
  slug text not null unique default encode(gen_random_bytes(8), 'hex'),
  owner_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  name text not null,
  description text,
  category text,
  subcategory text,
  custom_category text,
  keywords text[] not null default '{}',
  city text,
  state text,
  service_area text,
  public_phone text,
  public_email text,
  website_url text,
  hours jsonb not null default '{}'::jsonb,
  profile_image_url text,
  status text not null default 'draft'
    check (status in ('draft','pending_payment','active','hidden_unpaid','paused','suspended','rejected','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists businesses_owner_idx on public.businesses(owner_id);
create index if not exists businesses_status_location_idx on public.businesses(status, city, state);
create index if not exists businesses_keywords_idx on public.businesses using gin(keywords);

create table if not exists public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('staff','manager')),
  can_manage_billing boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (business_id,user_id)
);

create table if not exists public.business_entitlements (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','canceled')),
  paid_through timestamptz,
  renewal_reminders_enabled boolean not null default true,
  cancellation_effective_at timestamptz,
  provider_reference text,
  updated_at timestamptz not null default now()
);

create table if not exists public.private_business_locations (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  street_address text,
  postal_code text,
  exact_latitude double precision,
  exact_longitude double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.business_media (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('profile','gallery','showroom','menu','promotion')),
  caption text,
  sort_order integer not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','active','expired','unpublished','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status text not null default 'published' check (status in ('published','hidden','removed','reported')),
  created_at timestamptz not null default now()
);
create index if not exists reviews_business_published_idx on public.reviews(business_id, created_at desc) where status = 'published';

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin') $$;

create or replace function public.can_manage_business(target_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.businesses b where b.id = target_id and b.owner_id = auth.uid())
     or exists (select 1 from public.business_memberships m where m.business_id = target_id and m.user_id = auth.uid())
     or public.is_platform_admin()
$$;

create or replace function public.is_business_public(target_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    join public.business_entitlements e on e.business_id = b.id
    where b.id = target_id and b.status = 'active'
      and e.payment_status = 'paid' and e.paid_through > now()
  )
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.business_entitlements enable row level security;
alter table public.private_business_locations enable row level security;
alter table public.business_media enable row level security;
alter table public.promotions enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.audit_events enable row level security;

create policy "users_read_own_role" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy "categories_public_read" on public.categories for select to anon, authenticated using (active or public.is_platform_admin());
create policy "categories_admin_manage" on public.categories for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "business_public_read" on public.businesses for select to anon, authenticated using (public.is_business_public(id));
create policy "business_owner_read" on public.businesses for select to authenticated using (owner_id = auth.uid() or public.can_manage_business(id));
create policy "business_owner_insert" on public.businesses for insert to authenticated with check (owner_id = auth.uid());
create policy "business_owner_update" on public.businesses for update to authenticated using (public.can_manage_business(id)) with check (public.can_manage_business(id));
create policy "business_admin_manage" on public.businesses for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "membership_self_read" on public.business_memberships for select to authenticated using (user_id = auth.uid() or public.can_manage_business(business_id));
create policy "membership_owner_manage" on public.business_memberships for all to authenticated using (
  public.is_platform_admin() or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
) with check (
  public.is_platform_admin() or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);

create policy "entitlement_owner_read" on public.business_entitlements for select to authenticated using (public.can_manage_business(business_id));
create policy "entitlement_admin_manage" on public.business_entitlements for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "private_location_owner_read" on public.private_business_locations for select to authenticated using (public.can_manage_business(business_id));
create policy "private_location_owner_write" on public.private_business_locations for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

create policy "media_public_read" on public.business_media for select to anon, authenticated using (is_public and public.is_business_public(business_id));
create policy "media_owner_read" on public.business_media for select to authenticated using (public.can_manage_business(business_id));
create policy "media_owner_write" on public.business_media for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

create policy "promotion_public_read" on public.promotions for select to anon, authenticated using (status = 'active' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) and public.is_business_public(business_id));
create policy "promotion_owner_read" on public.promotions for select to authenticated using (public.can_manage_business(business_id));
create policy "promotion_owner_write" on public.promotions for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

create policy "review_public_read" on public.reviews for select to anon, authenticated using (status = 'published' and public.is_business_public(business_id));
create policy "review_auth_insert" on public.reviews for insert to authenticated with check (reviewer_id = auth.uid() and status = 'published' and public.is_business_public(business_id));
create policy "review_admin_moderate" on public.reviews for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "review_report_owner_insert" on public.review_reports for insert to authenticated with check (
  reported_by = auth.uid() and public.can_manage_business(business_id)
  and exists (select 1 from public.reviews r where r.id = review_id and r.business_id = business_id)
);
create policy "review_report_admin_read" on public.review_reports for select to authenticated using (public.is_platform_admin());

create policy "audit_admin_read" on public.audit_events for select to authenticated using (public.is_platform_admin());
create policy "audit_admin_insert" on public.audit_events for insert to authenticated with check (public.is_platform_admin() and actor_id = auth.uid());

-- These views intentionally expose only public columns and repeat all publication/payment filters.
create or replace view public.public_businesses as
select b.id, b.public_id, b.name, b.slug, b.description, b.category, b.subcategory,
       b.city, b.state, b.service_area, b.public_phone, b.public_email, b.website_url,
       b.profile_image_url, b.created_at,
       coalesce(avg(r.rating)::numeric(3,2), 0) as rating_average,
       count(r.id)::integer as rating_count
from public.businesses b
join public.business_entitlements e on e.business_id = b.id
left join public.reviews r on r.business_id = b.id and r.status = 'published'
where b.status = 'active' and e.payment_status = 'paid' and e.paid_through > now()
group by b.id, e.business_id;

create or replace view public.public_promotions as
select p.id, p.title, p.description, b.name as business_name, p.business_id
from public.promotions p join public.businesses b on b.id = p.business_id
join public.business_entitlements e on e.business_id = b.id
where p.status = 'active' and (p.starts_at is null or p.starts_at <= now())
  and (p.ends_at is null or p.ends_at > now()) and b.status = 'active'
  and e.payment_status = 'paid' and e.paid_through > now();

create or replace view public.public_reviews as
select r.id, r.business_id, r.rating, r.comment, r.created_at
from public.reviews r
where r.status = 'published' and public.is_business_public(r.business_id);

revoke all on public.user_roles, public.business_entitlements, public.private_business_locations,
  public.business_memberships, public.business_media, public.promotions, public.reviews,
  public.review_reports, public.audit_events from anon, authenticated;
revoke all on public.businesses from anon, authenticated;
revoke all on public.categories from anon, authenticated;
grant select on public.public_businesses, public.public_promotions, public.public_reviews to anon, authenticated;
grant select (id, name, city, state, created_at) on public.businesses to authenticated;
grant insert (name, description, category, subcategory, custom_category, keywords, city, state, service_area, public_phone, public_email, website_url, hours, profile_image_url) on public.businesses to authenticated;
grant update (name, description, category, subcategory, custom_category, keywords, city, state, service_area, public_phone, public_email, website_url, hours, profile_image_url) on public.businesses to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.business_entitlements to authenticated;
grant select, insert, update, delete on public.business_memberships to authenticated;
grant select, insert, update, delete on public.private_business_locations to authenticated;
grant select, insert, update, delete on public.business_media to authenticated;
grant select, insert, update, delete on public.promotions to authenticated;
grant insert on public.reviews to authenticated;
grant insert on public.review_reports to authenticated;
grant select, insert on public.audit_events to authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;

-- Business entitlements are server-managed. Configure the storage bucket and its folder policies
-- separately before enabling owner uploads. Do not set payment_status from browser code.
