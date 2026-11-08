-- Weekly Apple Ads Search Term Popularity is relative demand, never an organic rank.
create table if not exists public.aso_apple_keyword_popularity (
  keyword_id uuid not null references public.aso_keywords(id) on delete cascade,
  country text not null,
  genre text not null,
  week_start date not null,
  status text not null check (status in ('observed', 'not_reported')),
  popularity_1_to_100 integer check (popularity_1_to_100 between 1 and 100),
  popularity_in_genre integer check (popularity_in_genre between 1 and 100),
  popularity_1_to_5 integer check (popularity_1_to_5 between 1 and 5),
  rank_in_genre integer check (rank_in_genre > 0),
  collected_at timestamptz not null,
  request_sha256 text not null,
  response_sha256 text not null,
  source text not null default 'apple_ads_search_term_popularity',
  primary key (keyword_id, genre, week_start),
  constraint aso_apple_popularity_status_values check (
    (status = 'not_reported' and popularity_1_to_100 is null and popularity_in_genre is null and popularity_1_to_5 is null and rank_in_genre is null)
    or status = 'observed'
  )
);
create index if not exists aso_apple_popularity_recent on public.aso_apple_keyword_popularity(keyword_id, week_start desc);
alter table public.aso_apple_keyword_popularity enable row level security;
revoke all on public.aso_apple_keyword_popularity from anon, authenticated;
grant select, insert, update on public.aso_apple_keyword_popularity to service_role;
