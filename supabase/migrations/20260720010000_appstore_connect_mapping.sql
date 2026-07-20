-- App Store Connect uses its own app resource id, which is distinct from
-- the public App Store numeric id already stored in aso_apps.

alter table public.aso_apps
  add column if not exists appstore_connect_id text;

create unique index if not exists idx_aso_apps_appstore_connect_id
  on public.aso_apps (appstore_connect_id)
  where appstore_connect_id is not null;
