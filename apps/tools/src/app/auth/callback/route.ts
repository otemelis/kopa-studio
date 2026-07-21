import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get("code");
  const response = NextResponse.redirect(new URL(code ? "/" : "/login?error=invalid-link", request.url));

  if (!code) return response;

  const config = env.browser();
  const supabase = createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=expired-link", request.url));
  return response;
}
