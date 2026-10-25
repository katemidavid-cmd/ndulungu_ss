import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type MarkInput = {
  exam_id?: unknown;
  subject_id?: unknown;
  student_id?: unknown;
  theory_score?: unknown;
  practical_score?: unknown;
  is_absent?: unknown;
};

function isScore(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max
  );
}

async function getTeacherContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 as const };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { error: profileError.message, status: 500 as const };
  }
  if (profile?.role !== "teacher") {
    return { error: "Only teachers can manage marks here." as const, status: 403 as const };
  }

  const admin = createAdminClient();
  const { data: assignments, error: assignmentsError } = await admin
    .from("teaching_assignments")
    .select("class_name, subject_name")
    .eq("teacher_id", user.id);
  if (assignmentsError) {
    return { error: assignmentsError.message, status: 500 as const };
  }

  return { user, assignments: assignments ?? [], admin };
}

async function getEligibleStudents(
  admin: ReturnType<typeof createAdminClient>,
  classForm: string,
  subjectId: string,
) {
  const { data: schoolClasses, error: classesError } = await admin
    .from("classes")
    .select("id")
    .eq("form", classForm);
  if (classesError) throw new Error(classesError.message);

  const classIds = (schoolClasses ?? []).map((schoolClass) => schoolClass.id);
  if (classIds.length === 0) return [];

  const { data: students, error: studentsError } = await admin
    .from("students")
    .select("id, full_name, admission_no, class_id")
    .in("class_id", classIds)
    .order("full_name");
  if (studentsError) throw new Error(studentsError.message);

  const { data: classSubject, error: classSubjectError } = await admin
    .from("class_subject_assignments")
    .select("is_compulsory")
    .eq("form", classForm)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (classSubjectError) throw new Error(classSubjectError.message);
  if (!classSubject) return [];
  if (classSubject.is_compulsory) return students ?? [];

  const studentIds = (students ?? []).map((student) => student.id);
  if (studentIds.length === 0) return [];

  const { data: enrollments, error: enrollmentsError } = await admin
    .from("student_subjects")
    .select("student_id")
    .eq("subject_id", subjectId)
    .in("student_id", studentIds);
  if (enrollmentsError) throw new Error(enrollmentsError.message);
  const enrolledIds = new Set((enrollments ?? []).map((item) => item.student_id));
  return (students ?? []).filter((student) => enrolledIds.has(student.id));
}

export async function GET(request: Request) {
  const context = await getTeacherContext();
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status },
    );
  }
  const { assignments, admin } = context;
  const classForms = [...new Set(assignments.map((assignment) => assignment.class_name))];
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId");

  if (!examId) {
    if (classForms.length === 0) return NextResponse.json({ exams: [] });

    const { data: exams, error } = await admin
      .from("exams")
      .select("id, name, class_form, term, academic_year, start_date, end_date, has_practical, status")
      .in("class_form", classForms)
      .eq("status", "Active")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exams: exams ?? [] });
  }

  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, name, class_form, term, academic_year, start_date, end_date, has_practical, status")
    .eq("id", examId)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam || exam.status !== "Active" || !classForms.includes(exam.class_form)) {
    return NextResponse.json(
      { error: "This examination is not available for your assigned classes." },
      { status: 404 },
    );
  }

  const teacherSubjectNames = new Set(
    assignments
      .filter((assignment) => assignment.class_name === exam.class_form)
      .map((assignment) => assignment.subject_name),
  );
  const { data: examSubjects, error: examSubjectsError } = await admin
    .from("exam_subjects")
    .select("subject_id")
    .eq("exam_id", exam.id);
  if (examSubjectsError) {
    return NextResponse.json({ error: examSubjectsError.message }, { status: 500 });
  }
  const examSubjectIds = (examSubjects ?? []).map((item) => item.subject_id);
  if (examSubjectIds.length === 0) {
    return NextResponse.json({ error: "No subjects are attached to this examination." }, { status: 409 });
  }

  const { data: subjectRows, error: subjectsError } = await admin
    .from("subjects")
    .select("id, name, subject_code, has_practical")
    .in("id", examSubjectIds)
    .order("name");
  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }
  const subjects = (subjectRows ?? []).filter((subject) =>
    teacherSubjectNames.has(subject.name),
  );
  if (subjects.length === 0) {
    return NextResponse.json({ error: "You have no assigned subjects in this examination." }, { status: 403 });
  }

  const subjectId = searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ exam, subjects });
  }
  if (!subjects.some((subject) => subject.id === subjectId)) {
    return NextResponse.json({ error: "This subject is not assigned to you for this examination." }, { status: 403 });
  }

  try {
    const students = await getEligibleStudents(admin, exam.class_form, subjectId);
    const studentIds = students.map((student) => student.id);
    const { data: marks, error: marksError } = studentIds.length
      ? await admin
          .from("marks")
          .select("student_id, theory_score, practical_score, is_absent")
          .eq("exam_id", exam.id)
          .eq("subject_id", subjectId)
          .in("student_id", studentIds)
      : { data: [], error: null };
    if (marksError) {
      return NextResponse.json({ error: marksError.message }, { status: 500 });
    }
    return NextResponse.json({ exam, subjects, students, marks: marks ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load students for this subject.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getTeacherContext();
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status },
    );
  }
  const { user, assignments, admin } = context;

  let body: MarkInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const examId = typeof body.exam_id === "string" ? body.exam_id : "";
  const subjectId = typeof body.subject_id === "string" ? body.subject_id : "";
  const studentId = typeof body.student_id === "string" ? body.student_id : "";
  const isAbsent = body.is_absent === true;
  if (!examId || !subjectId || !studentId) {
    return NextResponse.json({ error: "Exam, subject, and student are required." }, { status: 400 });
  }

  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id, class_form, start_date, end_date, has_practical, status")
    .eq("id", examId)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam || exam.status !== "Active") {
    return NextResponse.json({ error: "This examination is not active." }, { status: 403 });
  }

  const { data: examSubject, error: examSubjectError } = await admin
    .from("exam_subjects")
    .select("subject_id")
    .eq("exam_id", examId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (examSubjectError) {
    return NextResponse.json({ error: examSubjectError.message }, { status: 500 });
  }
  if (!examSubject) {
    return NextResponse.json({ error: "This subject is not included in the examination." }, { status: 400 });
  }

  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .select("name, has_practical")
    .eq("id", subjectId)
    .maybeSingle();
  if (subjectError) return NextResponse.json({ error: subjectError.message }, { status: 500 });
  if (!subject || !assignments.some(
    (assignment) =>
      assignment.class_name === exam.class_form &&
      assignment.subject_name === subject.name,
  )) {
    return NextResponse.json({ error: "You are not assigned to teach this subject in this class." }, { status: 403 });
  }
  const subjectHasPractical = exam.has_practical && subject.has_practical;

  let eligibleStudents;
  try {
    eligibleStudents = await getEligibleStudents(admin, exam.class_form, subjectId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify student enrollment." },
      { status: 500 },
    );
  }
  if (!eligibleStudents.some((student) => student.id === studentId)) {
    return NextResponse.json({ error: "This student is not enrolled in the selected subject." }, { status: 403 });
  }

  const theory = isAbsent ? null : body.theory_score;
  const practical = isAbsent ? null : body.practical_score;
  if (!isAbsent && !isScore(theory, 100)) {
    return NextResponse.json({ error: "Theory marks must be between 0 and 100." }, { status: 400 });
  }
  if (subjectHasPractical) {
    if (!isAbsent && !isScore(practical, 50)) {
      return NextResponse.json({ error: "Practical marks must be between 0 and 50." }, { status: 400 });
    }
  } else if (body.practical_score !== undefined && body.practical_score !== null) {
    return NextResponse.json({ error: "This examination does not include practical marks." }, { status: 400 });
  }

  const theoryScore = isAbsent ? null : isScore(theory, 100) ? theory : null;
  const practicalScore =
    subjectHasPractical && !isAbsent && isScore(practical, 50)
      ? practical
      : null;
  if (!isAbsent && theoryScore === null) {
    return NextResponse.json({ error: "Theory marks are required." }, { status: 400 });
  }
  if (subjectHasPractical && !isAbsent && practicalScore === null) {
    return NextResponse.json({ error: "Practical marks are required." }, { status: 400 });
  }
  const totalScore =
    isAbsent || theoryScore === null
      ? null
      : theoryScore + (practicalScore ?? 0);
  const { data: mark, error: markError } = await admin
    .from("marks")
    .upsert(
      {
        exam_id: examId,
        subject_id: subjectId,
        student_id: studentId,
        theory_score: theoryScore,
        practical_score: practicalScore,
        total_score: totalScore,
        is_absent: isAbsent,
        entered_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "exam_id,student_id,subject_id" },
    )
    .select("student_id, theory_score, practical_score, is_absent")
    .single();
  if (markError) {
    return NextResponse.json({ error: markError.message }, { status: 500 });
  }

  return NextResponse.json({ mark });
}
