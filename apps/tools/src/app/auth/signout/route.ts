import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const config = env.browser();
  const supabase = createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => request.headers.get("cookie")?.split(";").map((part) => { const [name, ...rest] = part.trim().split("="); return { name, value: rest.join("=") }; }) ?? [], setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  await supabase.auth.signOut();
  return response;
}
