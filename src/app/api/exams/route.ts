import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (profile.role === 'teacher') {
    // Get teacher assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('teaching_assignments')
      .select('class_name, subject_name')
      .eq('teacher_id', user.id);
    if (assignmentsError) {
      return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
    }

    const classForms = [...new Set(assignments?.map(a => a.class_name) || [])];
    if (classForms.length === 0) return NextResponse.json({ exams: [] });

    const { data: exams, error: examsError } = await supabase
      .from('exams')
      .select('*')
      .in('class_form', classForms)
      .eq('status', 'Active')
      .order('created_at', { ascending: false });
    if (examsError) {
      return NextResponse.json({ error: examsError.message }, { status: 500 });
    }

    return NextResponse.json({ exams: exams || [] });
  }

  const { data: exams, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exams: exams || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'academic' && profile?.role !== 'headmaster') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    name?: unknown;
    class_form?: unknown;
    term?: unknown;
    academic_year?: unknown;
    start_date?: unknown;
    end_date?: unknown;
    subjects?: unknown;
    has_practical?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const classForm = typeof body.class_form === "string" ? body.class_form : "";
  const term = typeof body.term === "string" ? body.term : "";
  const academicYear =
    typeof body.academic_year === "string" ? body.academic_year.trim() : "";
  const startDate =
    typeof body.start_date === "string" ? body.start_date : "";
  const endDate = typeof body.end_date === "string" ? body.end_date : "";
  const subjects = Array.isArray(body.subjects) ? body.subjects : [];
  if (typeof body.has_practical !== "boolean") {
    return NextResponse.json(
      { error: "Specify whether the examination includes practical marks." },
      { status: 400 },
    );
  }
  const hasPractical = body.has_practical;

  if (!name || !academicYear || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["Form I", "Form II", "Form III", "Form IV"].includes(classForm)) {
    return NextResponse.json({ error: "Invalid class form" }, { status: 400 });
  }
  if (!["Term I", "Term II"].includes(term)) {
    return NextResponse.json({ error: "Invalid examination term" }, { status: 400 });
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)) ||
    Number.isNaN(Date.parse(`${endDate}T00:00:00Z`)) ||
    endDate < startDate
  ) {
    return NextResponse.json({ error: "Invalid examination date range" }, { status: 400 });
  }
  if (
    subjects.length === 0 ||
    subjects.length > 100 ||
    !subjects.every((subjectId) => typeof subjectId === "string" && subjectId.length > 0)
  ) {
    return NextResponse.json(
      { error: "Select between 1 and 100 valid examination subjects" },
      { status: 400 },
    );
  }
  if (subjects.length !== new Set(subjects).size) {
    return NextResponse.json({ error: "Duplicate subjects are not allowed" }, { status: 400 });
  }

  const { data: activePeriod, error: periodError } = await supabase
    .from("academic_period_settings")
    .select("academic_year, term")
    .eq("id", 1)
    .maybeSingle();
  if (periodError) {
    return NextResponse.json({ error: periodError.message }, { status: 500 });
  }
  if (!activePeriod) {
    return NextResponse.json(
      { error: "Set the active academic year and term before creating an examination." },
      { status: 409 },
    );
  }
  if (
    academicYear !== activePeriod.academic_year ||
    term !== activePeriod.term
  ) {
    return NextResponse.json(
      {
        error:
          "The active academic period changed. Refresh the page and create the examination again.",
      },
      { status: 409 },
    );
  }

  const { data: exam, error } = await supabase
    .from('exams')
    .insert({
      name,
      class_form: classForm,
      term,
      academic_year: academicYear,
      start_date: startDate,
      end_date: endDate,
      has_practical: hasPractical,
      status: 'Draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const examSubjects = subjects.map((subjectId) => ({
    exam_id: exam.id,
    subject_id: subjectId,
  }));
  const { error: subjectsError } = await supabase
    .from("exam_subjects")
    .insert(examSubjects);

  if (subjectsError) {
    const { error: rollbackError } = await supabase
      .from("exams")
      .delete()
      .eq("id", exam.id);
    if (rollbackError) {
      return NextResponse.json(
        {
          error: `Exam was created but subjects could not be added, and cleanup failed: ${rollbackError.message}`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  return NextResponse.json({ exam });
}
