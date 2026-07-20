-- Sales and Trends reports include proceeds in their native payout currency.
-- Preserve that currency beside each daily row instead of silently mixing
-- values from different storefronts in a portfolio total.

alter table public.aso_daily_metrics
  add column if not exists proceeds_currency text;
