-- Executed with explicit owner approval on 2026-10-15. Password placeholder only.
-- TLS login verified: read_only=on, statement_timeout=5s. RLS currently hides rows.
-- Password is generated privately at execution and never placed in this file or the browser.
-- Use the existing project's supported database connection; no REST schema exposure.
CREATE ROLE kopa_report_reader LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
  PASSWORD '<private-generated-password>';
GRANT CONNECT ON DATABASE postgres TO kopa_report_reader;
GRANT USAGE ON SCHEMA form, passport_analytics TO kopa_report_reader;
GRANT SELECT (event_id, installation_id, event_name, category, occurred_at, received_at,
              session_id, session_number, properties, app_version, build, build_channel,
              entitlement_state, experiment_snapshot, schema_version)
  ON form.events TO kopa_report_reader;
GRANT SELECT (day, build_channel, app_version, event, dims, count, updated_at)
  ON passport_analytics.daily_counts TO kopa_report_reader;
ALTER ROLE kopa_report_reader SET default_transaction_read_only = on;
ALTER ROLE kopa_report_reader SET statement_timeout = '5s';
-- No INSERT, UPDATE, DELETE, CREATE, function execution grant, role membership or public schema exposure.
-- Credentials stay in the local server environment, outside version control and static assets.
