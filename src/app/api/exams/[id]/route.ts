import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let query = supabase.from("exams").select("*").eq("id", id);

  if (profile.role === "teacher") {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("teaching_assignments")
      .select("class_name")
      .eq("teacher_id", user.id);
    if (assignmentsError) {
      return NextResponse.json(
        { error: assignmentsError.message },
        { status: 500 },
      );
    }

    const classForms = [
      ...new Set((assignments ?? []).map((assignment) => assignment.class_name)),
    ];
    if (classForms.length === 0) {
      return NextResponse.json(
        { error: "Examination not found." },
        { status: 404 },
      );
    }
    query = query.in("class_form", classForms).in("status", ["Active", "Processed"]);
  }

  const { data: exam, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!exam) {
    return NextResponse.json(
      { error: "Examination not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ exam });
}
