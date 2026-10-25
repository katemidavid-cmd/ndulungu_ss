import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TERMS = ["Term I", "Term II"];
const VALID_YEARS = ["2026", "2027", "2028", "2029", "2030"];

async function getAuthorizedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { supabase, user, role: null, profileError: error };

  return { supabase, user, role: profile?.role ?? null };
}

export async function GET() {
  const { supabase, user, role, profileError } = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: period, error } = await supabase
    .from("academic_period_settings")
    .select("academic_year, term")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!period) {
    return NextResponse.json(
      { error: "The active academic period has not been configured." },
      { status: 409 },
    );
  }

  return NextResponse.json({ period });
}

export async function PUT(request: Request) {
  const { supabase, user, role, profileError } = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (role !== "headmaster" && role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { academic_year?: unknown; term?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const academicYear =
    typeof body.academic_year === "string" ? body.academic_year.trim() : "";
  const term = typeof body.term === "string" ? body.term : "";
  if (!VALID_YEARS.includes(academicYear)) {
    return NextResponse.json(
      { error: "Academic year must be between 2026 and 2030." },
      { status: 400 },
    );
  }
  if (!VALID_TERMS.includes(term)) {
    return NextResponse.json(
      { error: "Term must be either Term I or Term II." },
      { status: 400 },
    );
  }

  const { data: period, error } = await supabase
    .from("academic_period_settings")
    .upsert(
      {
        id: 1,
        academic_year: academicYear,
        term,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("academic_year, term")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ period });
}
