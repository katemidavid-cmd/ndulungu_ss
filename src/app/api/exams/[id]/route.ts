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
    const { data: assignments } = await supabase
      .from('teaching_assignments')
      .select('class_name, subject_name')
      .eq('teacher_id', user.id);

    const classForms = [...new Set(assignments?.map(a => a.class_name) || [])];
    if (classForms.length === 0) return NextResponse.json({ exams: [] });

    const now = new Date().toISOString().split('T')[0];
    const { data: exams } = await supabase
      .from('exams')
      .select('*')
      .in('class_form', classForms)
      .eq('status', 'Active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false });

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

  const body = await request.json();
  const { name, class_form, term, academic_year, start_date, end_date, subjects = [] } = body;

  if (!name || !class_form || !term || !academic_year || !start_date || !end_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: exam, error } = await supabase
    .from('exams')
    .insert({
      name,
      class_form,
      term,
      academic_year,
      start_date,
      end_date,
      status: 'Draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (subjects && subjects.length > 0) {
    const examSubjects = subjects.map((sid: string) => ({ exam_id: exam.id, subject_id: sid }));
    await supabase.from('exam_subjects').insert(examSubjects);
  }

  return NextResponse.json({ exam });
}
