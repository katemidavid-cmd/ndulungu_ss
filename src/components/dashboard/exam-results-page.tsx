"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { notify } from "@/lib/notifications";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

type SubjectResult = {
  subject_id: string;
  subject: string;
  has_practical?: boolean;
  theory: number | null;
  practical: number | null;
  total: number;
  percentage: number;
  grade: string;
  points: number;
  absent: boolean;
};

type Result = {
  student_id: string;
  total_marks: number;
  average: number;
  grade: string;
  division: string;
  points: number;
  position: number;
  subject_breakdown: SubjectResult[];
  student: {
    full_name: string;
    admission_no: string | null;
  } | null;
};

type Exam = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  has_practical: boolean;
};

export function ExamResultsPage({
  examId,
  examsHref,
}: {
  examId: string;
  examsHref: string;
}) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadResults() {
      try {
        const response = await fetch(`/api/exams/${examId}/results`);
        const body = (await response.json()) as {
          exam?: Exam;
          results?: Result[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || "Unable to load examination results.");
        }
        if (!body.exam || !body.results) {
          throw new Error("The results response is incomplete.");
        }
        if (active) {
          setExam(body.exam);
          setResults(body.results);
        }
      } catch (error) {
        if (active) {
          notify(
            "error",
            error instanceof Error
              ? error.message
              : "Unable to load examination results.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadResults();
    return () => {
      active = false;
    };
  }, [examId]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Link
        href={examsHref}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Exam Management
      </Link>

      <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-5 text-white shadow-lg sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              {exam?.name ?? "Examination Results"}
            </h2>
            {exam && (
              <p className="mt-2 text-sm text-blue-100">
                {exam.class_form} · {exam.academic_year} · {exam.term}
                {exam.has_practical ? " · Theory /100 + Practical /50" : " · Theory /100"}
              </p>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <LoadingIndicator label="Loading results..." className="py-12" />
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
          No result records were found for this examination.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Students", results.length],
              ["Highest average", `${Math.max(...results.map((result) => result.average)).toFixed(2)}%`],
              ["Highest division", results[0]?.division ?? "—"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Pos.</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Admission No.</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Average</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Points</th>
                    <th className="px-4 py-3">Division</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((result) => (
                    <tr key={result.student_id} className="align-top">
                      <td className="px-4 py-4 font-bold text-slate-900">
                        {result.position}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {result.student?.full_name ?? "Student"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {result.student?.admission_no ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {Number(result.total_marks).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {Number(result.average).toFixed(2)}%
                      </td>
                      <td className="px-4 py-4 text-slate-700">{result.grade}</td>
                      <td className="px-4 py-4 text-slate-700">{result.points}</td>
                      <td className="px-4 py-4 font-semibold text-indigo-800">
                        {result.division}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900">Subject breakdown</h3>
            {results.map((result) => (
              <details
                key={`${result.student_id}-subjects`}
                className="group rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 font-semibold text-slate-900">
                  <span>{result.position}. {result.student?.full_name ?? "Student"}</span>
                  <span className="text-sm text-slate-500">
                    {Number(result.average).toFixed(2)}% · {result.division}
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Subject</th>
                        <th className="px-4 py-2.5">Theory</th>
                        {exam?.has_practical &&
                          result.subject_breakdown.some(
                            (subject) =>
                              subject.has_practical ?? exam.has_practical,
                          ) && (
                          <th className="px-4 py-2.5">Practical</th>
                        )}
                        <th className="px-4 py-2.5">Total</th>
                        <th className="px-4 py-2.5">Grade</th>
                        <th className="px-4 py-2.5">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.subject_breakdown.map((subject) => (
                        <tr key={subject.subject_id}>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {subject.subject}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {subject.absent ? "Absent" : subject.theory ?? "—"}
                          </td>
                          {exam?.has_practical &&
                            result.subject_breakdown.some(
                              (item) => item.has_practical ?? exam.has_practical,
                            ) && (
                            <td className="px-4 py-3 text-slate-600">
                              {subject.has_practical ?? exam.has_practical
                                ? subject.absent
                                  ? "Absent"
                                  : subject.practical ?? "—"
                                : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-slate-700">
                            {Number(subject.total).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{subject.grade}</td>
                          <td className="px-4 py-3 text-slate-700">{subject.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
