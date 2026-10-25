import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const subjectId = searchParams.get("subjectId");

  if (!classId || !subjectId) {
    return NextResponse.json({ error: "classId and subjectId are required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: students, error: studentsError } = await adminSupabase
    .from("students")
    .select("id")
    .eq("class_id", classId);

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const studentIds = (students || []).map((s) => s.id);
  if (studentIds.length === 0) {
    return NextResponse.json({ enrolledStudentIds: [] });
  }

  const { data: enrollments, error: enrollmentsError } = await adminSupabase
    .from("student_subjects")
    .select("student_id")
    .eq("subject_id", subjectId)
    .in("student_id", studentIds)
    .eq("enrollment_type", "optional");

  if (enrollmentsError) {
    return NextResponse.json({ error: enrollmentsError.message }, { status: 500 });
  }

  return NextResponse.json({
    enrolledStudentIds: (enrollments || []).map((e) => e.student_id),
  });
}
