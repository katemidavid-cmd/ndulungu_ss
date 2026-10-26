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
  const role = profile?.role;
  if (role !== "headmaster" && role !== "academic" && role !== "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, term, academic_year, start_date, end_date, has_practical, status")
    .eq("id", id)
    .maybeSingle();
  if (examError) {
    return NextResponse.json({ error: examError.message }, { status: 500 });
  }
  if (!exam) {
    return NextResponse.json({ error: "Examination not found." }, { status: 404 });
  }

  if (role === "teacher") {
    const { data: assignments, error: assignmentsError } = await admin
      .from("teaching_assignments")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("class_name", exam.class_form)
      .limit(1);
    if (assignmentsError) {
      return NextResponse.json(
        { error: assignmentsError.message },
        { status: 500 },
      );
    }
    if (!assignments?.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
      "student_id, total_marks, average, grade, division, points, position, is_incomplete, subject_breakdown",
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

  const [
    { data: school, error: schoolError },
    { data: examSubjects, error: examSubjectsError },
    { data: classes, error: classesError },
  ] = await Promise.all([
    admin
      .from("school_settings")
      .select("school_name, district, address")
      .eq("id", 1)
      .maybeSingle(),
    admin.from("exam_subjects").select("subject_id").eq("exam_id", id),
    admin.from("classes").select("id").eq("form", exam.class_form),
  ]);
  const metadataError = schoolError || examSubjectsError || classesError;
  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
  }

  const subjectIds = (examSubjects ?? []).map((item) => item.subject_id);
  const classIds = (classes ?? []).map((item) => item.id);
  const [
    { data: subjectRows, error: subjectRowsError },
    { data: classStudents, error: classStudentsError },
    { data: classAssignments, error: classAssignmentsError },
  ] = await Promise.all([
    subjectIds.length
      ? admin
          .from("subjects")
          .select("id, name, subject_code, has_practical")
          .in("id", subjectIds)
          .order("name")
      : { data: [], error: null },
    classIds.length
      ? admin.from("students").select("id, sex").in("class_id", classIds)
      : { data: [], error: null },
    subjectIds.length
      ? admin
          .from("class_subject_assignments")
          .select("subject_id, is_compulsory")
          .eq("form", exam.class_form)
          .in("subject_id", subjectIds)
      : { data: [], error: null },
  ]);
  const subjectsError = subjectRowsError || classStudentsError || classAssignmentsError;
  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const optionalSubjectIds = (classAssignments ?? [])
    .filter((assignment) => !assignment.is_compulsory)
    .map((assignment) => assignment.subject_id);
  const classStudentIds = (classStudents ?? []).map((student) => student.id);
  const { data: optionalEnrollments, error: enrollmentsError } =
    optionalSubjectIds.length > 0 && classStudentIds.length > 0
      ? await admin
          .from("student_subjects")
          .select("student_id, subject_id")
          .in("subject_id", optionalSubjectIds)
          .in("student_id", classStudentIds)
      : { data: [], error: null };
  if (enrollmentsError) {
    return NextResponse.json({ error: enrollmentsError.message }, { status: 500 });
  }

  const enrollmentCounts = new Map<string, number>();
  for (const enrollment of optionalEnrollments ?? []) {
    enrollmentCounts.set(
      enrollment.subject_id,
      (enrollmentCounts.get(enrollment.subject_id) ?? 0) + 1,
    );
  }
  const compulsorySubjects = new Set(
    (classAssignments ?? [])
      .filter((assignment) => assignment.is_compulsory)
      .map((assignment) => assignment.subject_id),
  );
  const subjects = (subjectRows ?? []).map((subject) => ({
    ...subject,
    registered: compulsorySubjects.has(subject.id)
      ? classStudentIds.length
      : enrollmentCounts.get(subject.id) ?? 0,
  }));

  const studentsById = new Map(
    (students ?? []).map((student) => [student.id, student]),
  );
  return NextResponse.json({
    exam,
    school: school ?? {
      school_name: "Ndulungu Secondary School",
      district: "",
      address: "",
    },
    subjects,
    results: (results ?? []).map((result) => ({
      ...result,
      student: studentsById.get(result.student_id) ?? null,
    })),
  });
}
