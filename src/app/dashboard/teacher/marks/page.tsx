"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardList, LoaderCircle } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { notify } from "@/lib/notifications";

type Exam = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  has_practical: boolean;
};

type Subject = {
  id: string;
  name: string;
  subject_code: string;
  has_practical: boolean;
};

type Student = {
  id: string;
  full_name: string;
  admission_no: string | null;
};

type Mark = {
  student_id: string;
  theory_score: number | null;
  practical_score: number | null;
  is_absent: boolean;
};

type MarkEntry = {
  theory: string;
  practical: string;
  absent: boolean;
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

async function readResponse<T>(response: Response): Promise<T> {
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(result.error || "Unable to load examination marks.");
  }
  return result;
}

export default function TeacherMarksPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<Record<string, MarkEntry>>({});
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);

  const selectExam = useCallback(async (nextExamId: string) => {
    setExamId(nextExamId);
    setExam(exams.find((item) => item.id === nextExamId) ?? null);
    setSubjectId("");
    setSubjects([]);
    setStudents([]);
    setEntries({});
    if (!nextExamId) return;

    setLoadingSubjects(true);
    try {
      const result = await readResponse<{ exam: Exam; subjects: Subject[] }>(
        await fetch(`/api/marks?examId=${encodeURIComponent(nextExamId)}`),
      );
      setExam(result.exam);
      setSubjects(result.subjects);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to load exam subjects.",
      );
    } finally {
      setLoadingSubjects(false);
    }
  }, [exams]);

  useEffect(() => {
    let active = true;

    async function loadExams() {
      try {
        const result = await readResponse<{ exams: Exam[] }>(
          await fetch("/api/marks"),
        );
        if (active) setExams(result.exams);
      } catch (error) {
        if (active) {
          notify(
            "error",
            error instanceof Error ? error.message : "Unable to load active examinations.",
          );
        }
      } finally {
        if (active) setLoadingExams(false);
      }
    }

    void loadExams();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const requestedExamId = new URLSearchParams(window.location.search).get("examId");
    if (
      requestedExamId &&
      requestedExamId !== examId &&
      exams.some((item) => item.id === requestedExamId)
    ) {
      const url = new URL(window.location.href);
      url.searchParams.delete("examId");
      window.history.replaceState(null, "", url);
      void Promise.resolve().then(() => selectExam(requestedExamId));
    }
  }, [examId, exams, selectExam]);

  async function selectSubject(nextSubjectId: string) {
    setSubjectId(nextSubjectId);
    setStudents([]);
    setEntries({});
    if (!examId || !nextSubjectId) return;

    setLoadingStudents(true);
    try {
      const query = new URLSearchParams({
        examId,
        subjectId: nextSubjectId,
      });
      const result = await readResponse<{
        students: Student[];
        marks: Mark[];
      }>(await fetch(`/api/marks?${query.toString()}`));

      const savedMarks = new Map(
        result.marks.map((mark) => [mark.student_id, mark]),
      );
      const initialEntries = Object.fromEntries(
        result.students.map((student) => {
          const mark = savedMarks.get(student.id);
          return [
            student.id,
            {
              theory:
                mark?.theory_score === null || mark?.theory_score === undefined
                  ? ""
                  : String(mark.theory_score),
              practical:
                mark?.practical_score === null ||
                mark?.practical_score === undefined
                  ? ""
                  : String(mark.practical_score),
              absent: mark?.is_absent ?? false,
            },
          ];
        }),
      );
      setStudents(result.students);
      setEntries(initialEntries);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to load students and marks.",
      );
    } finally {
      setLoadingStudents(false);
    }
  }

  function updateEntry(studentId: string, changes: Partial<MarkEntry>) {
    setEntries((current) => ({
      ...current,
      [studentId]: { ...current[studentId], ...changes },
    }));
  }

  async function saveMark(student: Student) {
    const entry = entries[student.id];
    if (!entry) return;
    const theory = entry.theory === "" ? null : Number(entry.theory);
    const practical = entry.practical === "" ? null : Number(entry.practical);

    if (!entry.absent && (theory === null || theory < 0 || theory > 100)) {
      notify("error", "Theory marks must be between 0 and 100.");
      return;
    }
    if (
      !entry.absent &&
      exam?.has_practical &&
      selectedSubject?.has_practical &&
      (practical === null || practical < 0 || practical > 50)
    ) {
      notify("error", "Practical marks must be between 0 and 50.");
      return;
    }

    setSavingStudentId(student.id);
    try {
      const result = await readResponse<{ mark: Mark }>(
        await fetch("/api/marks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exam_id: examId,
            subject_id: subjectId,
            student_id: student.id,
            theory_score: theory,
            practical_score: subjectHasPractical ? practical : null,
            is_absent: entry.absent,
          }),
        }),
      );
      const saved = result.mark;
      updateEntry(student.id, {
        theory: saved.theory_score === null ? "" : String(saved.theory_score),
        practical:
          saved.practical_score === null ? "" : String(saved.practical_score),
        absent: saved.is_absent,
      });
      notify("success", `Marks saved for ${student.full_name}.`);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to save marks.",
      );
    } finally {
      setSavingStudentId(null);
    }
  }

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const subjectHasPractical =
    Boolean(exam?.has_practical && selectedSubject?.has_practical);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-5 text-white shadow-lg sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Enter Examination Marks</h2>
            <p className="mt-1 text-sm text-blue-100">
              Enter theory marks out of 100. Practical marks are available only when enabled for both the examination and subject.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Active examination
          <select
            className={inputClass}
            value={examId}
            disabled={loadingExams}
            onChange={(event) => void selectExam(event.target.value)}
          >
            <option value="">
              {loadingExams ? "Loading examinations..." : "Select an examination"}
            </option>
            {exams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.class_form} · {item.academic_year} {item.term}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Subject
          <select
            className={inputClass}
            value={subjectId}
            disabled={!examId || loadingSubjects || subjects.length === 0}
            onChange={(event) => void selectSubject(event.target.value)}
          >
            <option value="">
              {loadingSubjects
                ? "Loading subjects..."
                : "Select a subject"}
            </option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
                {subject.subject_code ? ` (${subject.subject_code})` : ""}
              </option>
            ))}
          </select>
        </label>
        {exam && (
          <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-800">
              {exam.class_form} · {exam.academic_year} · {exam.term}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-800">
              Theory /100
            </span>
            {subjectHasPractical && (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                Practical /50
              </span>
            )}
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
              Mark entry open until results are processed
            </span>
          </div>
        )}
      </section>

      {loadingStudents ? (
        <LoadingIndicator label="Loading students and marks..." className="py-10" />
      ) : subjectId ? (
        <section className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {selectedSubject?.name ?? "Students"}
              </h3>
              <p className="text-sm text-slate-500">
                {students.length} student(s). Save each student&apos;s marks after entry.
              </p>
            </div>
          </div>
          {students.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
              No students are enrolled in this subject for the selected class.
            </div>
          ) : (
            <div className="grid gap-3">
              {students.map((student) => {
                const entry = entries[student.id];
                const saving = savingStudentId === student.id;
                return (
                  <article
                    key={student.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 lg:w-56">
                        <h4 className="truncate font-semibold text-slate-900">
                          {student.full_name}
                        </h4>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {student.admission_no || "No admission number"}
                        </p>
                      </div>

                      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
                        <label className="space-y-1 text-xs font-semibold text-slate-600">
                          Theory /100
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            inputMode="decimal"
                            disabled={entry?.absent}
                            value={entry?.theory ?? ""}
                            onChange={(event) =>
                              updateEntry(student.id, { theory: event.target.value })
                            }
                            className={inputClass}
                          />
                        </label>
                        {subjectHasPractical && (
                          <label className="space-y-1 text-xs font-semibold text-slate-600">
                            Practical /50
                            <input
                              type="number"
                              min="0"
                              max="50"
                              step="0.01"
                              inputMode="decimal"
                              disabled={entry?.absent}
                              value={entry?.practical ?? ""}
                              onChange={(event) =>
                                updateEntry(student.id, {
                                  practical: event.target.value,
                                })
                              }
                              className={inputClass}
                            />
                          </label>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                        <label className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={entry?.absent ?? false}
                            onChange={(event) =>
                              updateEntry(student.id, {
                                absent: event.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          />
                          Absent
                        </label>
                        <button
                          type="button"
                          disabled={saving || !entry}
                          onClick={() => void saveMark(student)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {saving ? "Saving..." : "Save marks"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
