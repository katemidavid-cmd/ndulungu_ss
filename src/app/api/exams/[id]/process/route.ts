import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GradeScale = Record<string, { min: number; max: number }>;
type GradePoints = Record<string, number>;
type DivisionRule = { name: string; min: number; max: number };

function gradeFor(percentage: number, scale: GradeScale) {
  const wholePercentage = Math.floor(percentage);
  return (
    Object.entries(scale).find(
      ([, range]) =>
        wholePercentage >= range.min && wholePercentage <= range.max,
    )?.[0] ?? "F"
  );
}

function pointsFor(grade: string, points: GradePoints) {
  return points[grade] ?? points.F ?? 5;
}

export async function POST(_request: Request, { params }: RouteContext) {
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
    .select("id, name, class_form, has_practical, status")
    .eq("id", id)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "Examination not found." }, { status: 404 });
  if (exam.status !== "Active") {
    return NextResponse.json(
      { error: "Only active examinations can be processed." },
      { status: 409 },
    );
  }

  const [
    { data: examSubjectRows, error: examSubjectsError },
    { data: classSubjectRows, error: classSubjectsError },
    { data: schoolClasses, error: classesError },
    { data: settingsRows, error: settingsError },
  ] = await Promise.all([
    admin.from("exam_subjects").select("subject_id").eq("exam_id", id),
    admin
      .from("class_subject_assignments")
      .select("subject_id, is_compulsory")
      .eq("form", exam.class_form),
    admin.from("classes").select("id").eq("form", exam.class_form),
    admin
      .from("exam_settings")
      .select("grading_scale, grade_points, division_rules")
      .limit(1),
  ]);
  const queryError =
    examSubjectsError || classSubjectsError || classesError || settingsError;
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const examSubjectIds = [
    ...new Set((examSubjectRows ?? []).map((row) => row.subject_id)),
  ];
  if (examSubjectIds.length === 0) {
    return NextResponse.json(
      { error: "Add at least one subject before processing results." },
      { status: 400 },
    );
  }
  const examSubjectSet = new Set(examSubjectIds);
  const classSubjectSet = new Set(
    (classSubjectRows ?? []).map((assignment) => assignment.subject_id),
  );
  if (examSubjectIds.some((subjectId) => !classSubjectSet.has(subjectId))) {
    return NextResponse.json(
      { error: "An examination subject is not assigned to this class form." },
      { status: 409 },
    );
  }
  const { data: subjectRows, error: subjectRowsError } = await admin
    .from("subjects")
    .select("id, name, has_practical")
    .in("id", examSubjectIds);
  if (subjectRowsError) {
    return NextResponse.json({ error: subjectRowsError.message }, { status: 500 });
  }
  const subjectById = new Map(
    (subjectRows ?? []).map((subject) => [subject.id, subject]),
  );
  const subjectHasPractical = (subjectId: string) =>
    Boolean(exam.has_practical && subjectById.get(subjectId)?.has_practical);

  const classIds = (schoolClasses ?? []).map((schoolClass) => schoolClass.id);
  if (classIds.length === 0) {
    return NextResponse.json(
      { error: "There are no classes or students for this form." },
      { status: 400 },
    );
  }

  const { data: students, error: studentsError } = await admin
    .from("students")
    .select("id, full_name, class_id")
    .in("class_id", classIds)
    .order("full_name");
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }
  if (!students?.length) {
    return NextResponse.json(
      { error: "There are no students to process for this examination." },
      { status: 400 },
    );
  }

  const optionalSubjectIds = (classSubjectRows ?? [])
    .filter((assignment) => !assignment.is_compulsory)
    .map((assignment) => assignment.subject_id)
    .filter((subjectId) => examSubjectSet.has(subjectId));
  const { data: optionalEnrollments, error: enrollmentError } =
    optionalSubjectIds.length > 0
      ? await admin
          .from("student_subjects")
          .select("student_id, subject_id")
          .in(
            "student_id",
            students.map((student) => student.id),
          )
          .in("subject_id", optionalSubjectIds)
      : { data: [], error: null };
  if (enrollmentError) {
    return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
  }
  const enrollmentSet = new Set(
    (optionalEnrollments ?? []).map(
      (item) => `${item.student_id}:${item.subject_id}`,
    ),
  );

  const expectedEntries = students.flatMap((student) =>
    examSubjectIds
      .filter((subjectId) => {
        const classSubject = classSubjectRows?.find(
          (assignment) => assignment.subject_id === subjectId,
        );
        return (
          classSubject?.is_compulsory ||
          enrollmentSet.has(`${student.id}:${subjectId}`)
        );
      })
      .map((subjectId) => ({ student_id: student.id, subject_id: subjectId })),
  );
  if (expectedEntries.length === 0) {
    return NextResponse.json(
      { error: "No students are enrolled in the selected examination subjects." },
      { status: 400 },
    );
  }

  const { data: marks, error: marksError } = await admin
    .from("marks")
    .select("student_id, subject_id, theory_score, practical_score, is_absent")
    .eq("exam_id", id);
  if (marksError) return NextResponse.json({ error: marksError.message }, { status: 500 });
  const markMap = new Map(
    (marks ?? []).map((mark) => [
      `${mark.student_id}:${mark.subject_id}`,
      mark,
    ]),
  );
  const missingMarks = expectedEntries.filter(({ student_id, subject_id }) => {
    const mark = markMap.get(`${student_id}:${subject_id}`);
    return (
      !mark ||
      (!mark.is_absent &&
        (mark.theory_score === null ||
          (subjectHasPractical(subject_id) && mark.practical_score === null)))
    );
  });
  if (missingMarks.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot process yet: ${missingMarks.length} student subject mark(s) are still incomplete.`,
        missing_count: missingMarks.length,
      },
      { status: 409 },
    );
  }

  const settings = settingsRows?.[0];
  const scale = (settings?.grading_scale ?? {
    A: { min: 75, max: 100 },
    B: { min: 65, max: 74 },
    C: { min: 45, max: 64 },
    D: { min: 30, max: 44 },
    F: { min: 0, max: 29 },
  }) as GradeScale;
  const gradePoints = (settings?.grade_points ?? {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    F: 5,
  }) as GradePoints;
  const divisionSettings = settings?.division_rules as
    | { best_subjects?: number; divisions?: DivisionRule[] }
    | null;
  const divisionRules = divisionSettings?.divisions ?? [
    { name: "DIV I", min: 7, max: 17 },
    { name: "DIV II", min: 18, max: 21 },
    { name: "DIV III", min: 22, max: 25 },
    { name: "DIV IV", min: 26, max: 33 },
    { name: "DIV 0", min: 34, max: 35 },
  ];
  const subjectNames = new Map(
    (subjectRows ?? []).map((subject) => [subject.id, subject.name]),
  );
  const bestSubjects = Math.max(1, Number(divisionSettings?.best_subjects ?? 7));

  const resultRows = students
    .filter((student) =>
      expectedEntries.some((entry) => entry.student_id === student.id),
    )
    .map((student) => {
    const breakdown = expectedEntries
      .filter((entry) => entry.student_id === student.id)
      .map(({ subject_id }) => {
        const mark = markMap.get(`${student.id}:${subject_id}`);
        const rawTotal = mark?.is_absent
          ? 0
          : Number(mark?.theory_score ?? 0) +
            Number(subjectHasPractical(subject_id) ? mark?.practical_score ?? 0 : 0);
        const hasPractical = subjectHasPractical(subject_id);
        const maximum = hasPractical ? 150 : 100;
        const percentage = Math.round((rawTotal / maximum) * 10000) / 100;
        const grade = gradeFor(percentage, scale);
        return {
          subject_id,
          subject: subjectNames.get(subject_id) ?? "Subject",
          has_practical: hasPractical,
          theory: mark?.is_absent ? null : mark?.theory_score,
          practical:
            hasPractical && !mark?.is_absent
              ? mark?.practical_score
              : null,
          total: rawTotal,
          percentage,
          grade,
          points: pointsFor(grade, gradePoints),
          absent: mark?.is_absent ?? false,
        };
        });
    const totalMarks = breakdown.reduce((sum, subject) => sum + subject.total, 0);
    const average =
      breakdown.length > 0
        ? Math.round(
            (breakdown.reduce((sum, subject) => sum + subject.percentage, 0) /
              breakdown.length) *
              100,
          ) / 100
        : 0;
    const points = breakdown
      .map((subject) => subject.points)
      .sort((a, b) => a - b)
      .slice(0, bestSubjects)
      .reduce((sum, value) => sum + value, 0);
    const division =
      divisionRules.find((rule) => points >= rule.min && points <= rule.max)
        ?.name ?? "DIV 0";

    return {
      exam_id: id,
      student_id: student.id,
      total_marks: totalMarks,
      average,
      grade: gradeFor(average, scale),
      division,
      points,
      is_incomplete: false,
      subject_breakdown: breakdown,
      computed_at: new Date().toISOString(),
    };
  });

  const rankedRows = [...resultRows]
    .sort((a, b) => b.average - a.average || a.points - b.points)
    .map((result, index) => ({ ...result, position: index + 1 }));
  const { error: upsertError } = await admin
    .from("exam_results")
    .upsert(rankedRows, { onConflict: "exam_id,student_id" });
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data: processedExam, error: updateError } = await admin
    .from("exams")
    .update({
      status: "Processed",
      processed_at: new Date().toISOString(),
      processed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "Active")
    .select("id, status")
    .maybeSingle();
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!processedExam) {
    return NextResponse.json(
      {
        error:
          "Results were calculated, but the exam status changed. Refresh and verify the results.",
      },
      { status: 409 },
    );
  }

  const { error: auditError } = await admin.from("exam_audit_logs").insert({
    exam_id: id,
    user_id: user.id,
    action: "processed",
    details: { results_count: rankedRows.length },
  });
  if (auditError) {
    return NextResponse.json(
      {
        error: `Results were processed, but the audit log could not be written: ${auditError.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    exam: processedExam,
    results_count: rankedRows.length,
  });
}
