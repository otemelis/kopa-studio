-- Restore the previously approved read-only Kopa grant. The RLS SELECT policy
-- already exists, but without this table grant the PASSPORT Signals query fails.
grant select on table passport_analytics.daily_counts to kopa_report_reader;
