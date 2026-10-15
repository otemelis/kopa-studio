-- Applied with separate explicit owner approval on 2026-10-15. Existing RLS stays enabled.
-- These policies apply only to the approved direct-SQL login, not browser/API roles.
CREATE POLICY kopa_report_reader_select ON form.events
  FOR SELECT TO kopa_report_reader USING (true);
CREATE POLICY kopa_report_reader_select ON passport_analytics.daily_counts
  FOR SELECT TO kopa_report_reader USING (true);
-- Existing column grants still limit readable columns. No write policies or BYPASSRLS.
-- Rollback: DROP POLICY kopa_report_reader_select ON form.events;
--           DROP POLICY kopa_report_reader_select ON passport_analytics.daily_counts;
