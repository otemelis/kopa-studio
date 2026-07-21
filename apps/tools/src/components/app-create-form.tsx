"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AppCreateForm() { const router = useRouter(); const [open, setOpen] = useState(false); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(form: FormData) { setPending(true); setMessage(""); const response = await fetch("/api/apps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: form.get("input"), country: form.get("country") }) }); const body = await response.json(); setPending(false); if (!response.ok) return setMessage(body.error ?? "Could not add app."); setOpen(false); router.refresh(); }
  return <><button className="primary compact" onClick={() => setOpen(!open)}>{open ? "Close" : "Add app"}</button>{open && <form action={submit} className="management-form"><label>App Store URL or numeric id<input name="input" required placeholder="https://apps.apple.com/.../id123456" /></label><label>Primary storefront<input name="country" defaultValue="us" maxLength={2} required /></label>{message && <p className="error">{message}</p>}<button className="primary" disabled={pending}>{pending ? "Looking up…" : "Look up and add"}</button></form>}</>; }
