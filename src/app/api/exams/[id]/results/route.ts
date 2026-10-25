import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  if (profile?.role !== "headmaster" && profile?.role !== "academic") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, term, academic_year, has_practical, status")
    .eq("id", id)
    .maybeSingle();
  if (examError) {
    return NextResponse.json({ error: examError.message }, { status: 500 });
  }
  if (!exam) {
    return NextResponse.json({ error: "Examination not found." }, { status: 404 });
  }
  if (exam.status !== "Processed") {
    return NextResponse.json(
      { error: "Results are available after the examination has been processed." },
      { status: 409 },
    );
  }

  const { data: results, error: resultsError } = await admin
    .from("exam_results")
    .select(
      "student_id, total_marks, average, grade, division, points, position, subject_breakdown",
    )
    .eq("exam_id", id)
    .order("position");
  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  const studentIds = (results ?? []).map((result) => result.student_id);
  const { data: students, error: studentsError } = studentIds.length
    ? await admin
        .from("students")
        .select("id, full_name, admission_no, sex")
        .in("id", studentIds)
    : { data: [], error: null };
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const studentsById = new Map(
    (students ?? []).map((student) => [student.id, student]),
  );
  return NextResponse.json({
    exam,
    results: (results ?? []).map((result) => ({
      ...result,
      student: studentsById.get(result.student_id) ?? null,
    })),
  });
}
