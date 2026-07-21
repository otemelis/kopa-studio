"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(form: FormData) {
    setPending(true); setError(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setError("Supabase is not configured."); setPending(false); return; }
    const supabase = createBrowserClient(url, key);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    if (signInError) { setError("Sign-in failed. Check your email and password."); setPending(false); return; }
    window.location.assign("/");
  }
  return <form action={submit} className="login-card"><p className="eyebrow">Kopa Tools</p><h1>Sign in</h1><p>Private studio access only.</p><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={pending} type="submit">{pending ? "Signing in…" : "Continue"}</button></form>;
}
