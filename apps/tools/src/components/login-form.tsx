"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(form: FormData) {
    setPending(true); setError(null); setMessage(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setError("Supabase is not configured."); setPending(false); return; }
    const supabase = createBrowserClient(url, key);
    const email = String(form.get("email"));
    if (form.get("intent") === "email-link") {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
      });
      if (linkError) { setError(`We could not send a sign-in link: ${linkError.message}`); setPending(false); return; }
      setMessage("Check your inbox for a secure sign-in link."); setPending(false); return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: String(form.get("password")) });
    if (signInError) { setError("Sign-in failed. Check your email and password."); setPending(false); return; }
    window.location.assign("/");
  }
  return <form action={submit} className="login-card"><p className="eyebrow">Kopa Tools</p><h1>Sign in</h1><p>Private studio access only.</p><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password <span className="optional">optional with an email link</span><input name="password" type="password" autoComplete="current-password" /></label>{error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}<button className="primary" disabled={pending} name="intent" value="password" type="submit">{pending ? "Signing in…" : "Sign in with password"}</button><button className="secondary" disabled={pending} name="intent" value="email-link" type="submit">Email me a sign-in link</button></form>;
}
