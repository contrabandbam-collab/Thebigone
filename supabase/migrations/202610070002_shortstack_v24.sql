-- Additive v2.4 upgrade. Apply to a restored development copy first.
-- This migration preserves existing business IDs, slugs, reviews, and historical records.

alter table public.businesses add column if not exists entity_type text check (entity_type is null or entity_type in ('sole_proprietor','llc','corporation','partnership','other'));
alter table public.businesses add column if not exists business_type text not null default 'storefront' check (business_type in ('storefront','service_area','mobile'));
alter table public.businesses add column if not exists public_postal_code text;
alter table public.businesses add column if not exists is_mobile boolean not null default false;
alter table public.businesses add column if not exists services text[] not null default '{}';
alter table public.businesses add column if not exists products text[] not null default '{}';

alter table public.business_memberships add column if not exists can_manage_listing boolean not null default false;
alter table public.business_memberships add column if not exists can_manage_media boolean not null default false;
alter table public.business_memberships add column if not exists can_manage_promotions boolean not null default false;
alter table public.business_memberships add column if not exists can_manage_reviews boolean not null default false;

create table if not exists public.business_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  payment_kind text not null check (payment_kind in ('enrollment','renewal','reactivation')),
  amount numeric(8,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null check (status in ('pending','paid','declined','failed','refunded','canceled')),
  term_starts_at timestamptz,
  term_ends_at timestamptz,
  provider_name text,
  provider_payment_reference text,
  provider_event_id text unique,
  idempotency_key text unique,
  referral_discount_applied boolean not null default false,
  created_at timestamptz not null default now(),
  check ((payment_kind = 'enrollment' and amount = 19.99)
      or (payment_kind = 'renewal' and amount in (12.50, 25.00))
      or (payment_kind = 'reactivation' and amount = 25.00)),
  check ((amount = 12.50 and payment_kind = 'renewal' and referral_discount_applied)
      or (amount <> 12.50 and not referral_discount_applied))
);

create table if not exists public.business_referrals (
  id uuid primary key default gen_random_uuid(),
  referring_owner_id uuid not null references auth.users(id) on delete restrict,
  referred_owner_id uuid not null references auth.users(id) on delete restrict,
  referred_business_id uuid not null unique references public.businesses(id) on delete restrict,
  qualifying_payment_id uuid unique references public.business_payments(id) on delete restrict,
  qualified_at timestamptz,
  discount_applied_at timestamptz,
  created_at timestamptz not null default now(),
  check (referring_owner_id <> referred_owner_id),
  check (discount_applied_at is null or qualified_at is not null)
);
create unique index if not exists business_referrals_one_reward_per_owner_idx
  on public.business_referrals(referring_owner_id) where discount_applied_at is not null;

alter table public.business_payments enable row level security;
alter table public.business_referrals enable row level security;
revoke all on public.business_payments, public.business_referrals from anon, authenticated;
grant select on public.business_payments, public.business_referrals to authenticated;

create or replace function public.can_manage_business(target_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin()
     or exists (select 1 from public.businesses b where b.id = target_id and b.owner_id = auth.uid())
     or exists (select 1 from public.business_memberships m where m.business_id = target_id and m.user_id = auth.uid() and m.role = 'manager')
$$;

create or replace function public.has_business_permission(target_id uuid, permission_name text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin()
     or exists (select 1 from public.businesses b where b.id = target_id and b.owner_id = auth.uid())
     or exists (
       select 1 from public.business_memberships m
       where m.business_id = target_id and m.user_id = auth.uid()
         and (m.role = 'manager' or
           case permission_name
             when 'listing' then m.can_manage_listing
             when 'media' then m.can_manage_media
             when 'promotions' then m.can_manage_promotions
             when 'billing' then m.can_manage_billing
             when 'reviews' then m.can_manage_reviews
             else false
           end)
     )
$$;

grant select (public_id, description, subcategory, custom_category, keywords, service_area,
  public_phone, public_email, website_url, hours, profile_image_url, updated_at,
  business_type, public_postal_code, is_mobile, services, products)
  on public.businesses to authenticated;
grant insert (entity_type, business_type, is_mobile, services, products, public_postal_code)
  on public.businesses to authenticated;
grant update (entity_type, business_type, is_mobile, services, products, public_postal_code)
  on public.businesses to authenticated;

create policy "business_staff_read_assigned" on public.businesses for select to authenticated
using (public.has_business_permission(id, 'listing'));
create policy "business_staff_update_assigned" on public.businesses for update to authenticated
using (public.has_business_permission(id, 'listing'))
with check (public.has_business_permission(id, 'listing'));

create policy "media_staff_read_assigned" on public.business_media for select to authenticated
using (public.has_business_permission(business_id, 'media'));
create policy "media_staff_write_assigned" on public.business_media for all to authenticated
using (public.has_business_permission(business_id, 'media'))
with check (public.has_business_permission(business_id, 'media'));
create policy "promotion_staff_read_assigned" on public.promotions for select to authenticated
using (public.has_business_permission(business_id, 'promotions'));
create policy "promotion_staff_write_assigned" on public.promotions for all to authenticated
using (public.has_business_permission(business_id, 'promotions'))
with check (public.has_business_permission(business_id, 'promotions'));
create policy "billing_permission_read_entitlement" on public.business_entitlements for select to authenticated
using (public.has_business_permission(business_id, 'billing'));
create policy "billing_permission_read_payments" on public.business_payments for select to authenticated
using (public.has_business_permission(business_id, 'billing'));
create policy "business_owner_read_payments" on public.business_payments for select to authenticated
using (public.can_manage_business(business_id));
create policy "business_owner_read_referrals" on public.business_referrals for select to authenticated
using (referring_owner_id = auth.uid() or public.is_platform_admin());

create or replace view public.public_businesses as
select b.id, b.public_id, b.name, b.slug, b.description, b.category, b.subcategory,
       b.city, b.state, b.service_area, b.public_phone, b.public_email, b.website_url,
       b.profile_image_url, b.created_at,
       coalesce(avg(r.rating)::numeric(3,2), 0) as rating_average,
       count(r.id)::integer as rating_count,
       b.business_type, b.custom_category, b.keywords, b.services,
       b.products, b.public_postal_code, b.is_mobile
from public.businesses b
join public.business_entitlements e on e.business_id = b.id
left join public.reviews r on r.business_id = b.id and r.status = 'published'
where b.status = 'active' and e.payment_status = 'paid' and e.paid_through > now()
group by b.id, e.business_id;

-- One stable, server-selected eligible listing per rolling 24-hour period.
create or replace view public.public_business_highlight as
select b.* from public.public_businesses b
order by md5(b.id::text || floor(extract(epoch from now()) / 86400)::text)
limit 1;

grant select on public.public_business_highlight to anon, authenticated;

create or replace function public.search_public_businesses(query_text text default '', location_text text default '', result_limit integer default 48)
returns setof public.public_businesses
language sql stable security definer set search_path = public
as $$
  with normalized as (
    select case
      when lower(coalesce(query_text, '')) ~ 'install.*appliance|appliance.*install' then 'appliance installation installer'
      when lower(coalesce(query_text, '')) ~ 'brake' then 'brake repair mechanic'
      when lower(coalesce(query_text, '')) ~ 'birthday.*cake|cake.*birthday' then 'custom birthday cake bakery'
      else regexp_replace(lower(coalesce(query_text, '')), 'near me|nearby', '', 'g')
    end as value
  ), terms as (
    select array_agg(token) as items
    from normalized n, regexp_split_to_table(n.value, '[^[:alnum:]]+') as tokens(token)
    where length(token) > 2 and token not in ('the','and','for','with','near','who','someone','somebody','need','want','find','please','help','me','my','you','nearby','local')
  ), searchable as (
    select b.*,
      lower(concat_ws(' ', b.name, b.description, b.category, b.subcategory,
        b.custom_category, array_to_string(b.keywords, ' '), array_to_string(b.services, ' '),
        array_to_string(b.products, ' '), b.city, b.state, b.public_postal_code,
        b.service_area, case when b.is_mobile then 'mobile' end,
        (select string_agg(p.title || ' ' || coalesce(p.description,''), ' ')
         from public.public_promotions p where p.business_id = b.id))) as search_text
    from public.public_businesses b
  )
  select s.id, s.public_id, s.name, s.slug, s.description, s.category, s.subcategory,
         s.city, s.state, s.service_area, s.public_phone, s.public_email, s.website_url,
         s.profile_image_url, s.created_at, s.rating_average, s.rating_count,
         s.business_type, s.custom_category, s.keywords, s.services,
         s.products, s.public_postal_code, s.is_mobile
  from searchable s cross join terms t
  where (coalesce(trim(location_text), '') = '' or
         concat_ws(' ', s.city, s.state, s.public_postal_code, s.service_area) ilike '%' || trim(location_text) || '%')
    and (coalesce(trim(query_text), '') = '' or s.search_text ilike '%' || lower(trim(query_text)) || '%'
         or exists (select 1 from unnest(coalesce(t.items, array[]::text[])) term
                    where s.search_text ilike '%' || term || '%'))
  order by case when lower(s.name) = lower(trim(query_text)) then 0 else 1 end,
           s.rating_count desc, s.name
  limit least(greatest(coalesce(result_limit, 48), 1), 100)
$$;

grant execute on function public.search_public_businesses(text, text, integer) to anon, authenticated;

create or replace view public.owner_business_dashboard as
select b.id, b.name, b.city, b.state, b.status, b.created_at,
       coalesce(e.payment_status, 'unpaid') as payment_status, e.paid_through,
       e.cancellation_effective_at, coalesce(e.renewal_reminders_enabled, false) as renewal_reminders_enabled
from public.businesses b
left join public.business_entitlements e on e.business_id = b.id
where b.owner_id = auth.uid()
   or exists (select 1 from public.business_memberships m where m.business_id = b.id and m.user_id = auth.uid() and m.can_manage_billing)
   or public.is_platform_admin();
grant select on public.owner_business_dashboard to authenticated;

-- Payment/referral writes are server-side only. No browser grant is issued for status changes.
comment on table public.business_payments is 'Verified payment history. Insert/update only through trusted server-side payment handling.';
comment on table public.business_referrals is 'Referral qualification and one-time renewal rewards. Writes are server-managed.';
