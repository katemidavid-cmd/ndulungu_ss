import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    if (role === "headmaster" && !path.startsWith("/dashboard/headmaster")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/headmaster";
      return NextResponse.redirect(url);
    }
    if (role === "academic" && !path.startsWith("/dashboard/academic")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/academic";
      return NextResponse.redirect(url);
    }
    if (role === "teacher" && !path.startsWith("/dashboard/teacher")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/teacher";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
