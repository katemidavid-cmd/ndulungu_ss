import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();
  const { data: assignments, error } = await adminSupabase
    .from("teaching_assignments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { teacher_id, class_name, subject_name } = body;

  if (!teacher_id || !class_name || !subject_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validForms = ["Form I", "Form II", "Form III", "Form IV"];
  if (!validForms.includes(class_name)) {
    return NextResponse.json(
      { error: "Select a form, not an individual stream." },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: teacher, error: teacherError } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("id", teacher_id)
    .eq("role", "teacher")
    .maybeSingle();

  if (teacherError) {
    return NextResponse.json({ error: teacherError.message }, { status: 500 });
  }
  if (!teacher) {
    return NextResponse.json({ error: "Select a valid teacher." }, { status: 400 });
  }

  const { data: classSubjects, error: classSubjectsError } = await adminSupabase
    .from("class_subject_assignments")
    .select("subject_id")
    .eq("form", class_name);

  if (classSubjectsError) {
    return NextResponse.json({ error: classSubjectsError.message }, { status: 500 });
  }

  const subjectIds = (classSubjects || []).map((assignment) => assignment.subject_id);
  if (!subjectIds.length) {
    return NextResponse.json(
      { error: `No subjects are assigned to ${class_name}.` },
      { status: 400 },
    );
  }

  const { data: subject, error: subjectError } = await adminSupabase
    .from("subjects")
    .select("name")
    .eq("name", subject_name)
    .in("id", subjectIds)
    .maybeSingle();

  if (subjectError) {
    return NextResponse.json({ error: subjectError.message }, { status: 500 });
  }
  if (!subject) {
    return NextResponse.json(
      { error: `That subject is not assigned to ${class_name}.` },
      { status: 400 },
    );
  }

  const { error } = await adminSupabase.from("teaching_assignments").insert({
    teacher_id,
    class_name,
    subject_name: subject.name,
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "This teacher already has this subject assigned to this class."
            : error.message,
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json({ success: true });
}
