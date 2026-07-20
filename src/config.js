// Local-only fallback, used solely if /api/config is unreachable. Never put
// a real key here — this file ships to every visitor's browser as-is.
// SECURITY: this used to hardcode a live sb_secret_... key (Supabase's
// service-role-equivalent, RLS-bypassing key) here. That key must be
// rotated in the Supabase dashboard (Settings -> API) if it hasn't been
// already. The real config now comes exclusively from /api/config, which
// reads SUPABASE_URL / SUPABASE_ANON_KEY from Vercel env vars server-side —
// make sure SUPABASE_ANON_KEY there is the sb_publishable_... key, not a
// secret one, since /api/config hands it directly to the browser.
window.KOPA_CONFIG = window.KOPA_CONFIG || {
  supabaseUrl: "",
  supabaseAnonKey: "",
  eventsTable: "events"
};
