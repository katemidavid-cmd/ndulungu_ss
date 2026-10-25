"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Moon,
  Printer,
  Search,
  Sun,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

type SubjectResult = {
  subject_id: string;
  subject: string;
  code?: string;
  has_practical?: boolean;
  theory: number | null;
  practical: number | null;
  total: number | null;
  percentage: number | null;
  grade: string;
  points: number | null;
  absent: boolean;
  missing?: boolean;
};

type Result = {
  student_id: string;
  total_marks: number;
  average: number | null;
  grade: string;
  division: string;
  points: number;
  position: number | null;
  is_incomplete: boolean;
  subject_breakdown: SubjectResult[];
  student: {
    full_name: string;
    admission_no: string | null;
    sex: "F" | "M";
  } | null;
};

type Exam = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  has_practical: boolean;
  status: "Draft" | "Active" | "Processed";
};

type Subject = {
  id: string;
  name: string;
  subject_code: string;
  has_practical: boolean;
  registered: number;
};

type School = {
  school_name: string;
  district: string;
  address: string;
};

type ReportSubjectResult = SubjectResult & {
  percentage: number | null;
  grade: string;
  points: number | null;
  missing: boolean;
};

type SubjectPerformance = {
  subject: Subject;
  average: number | null;
  grade: string;
  gpa: number | null;
  competency: string;
  sat: number;
  pass: number;
  grades: Record<string, { F: number; M: number; T: number }>;
};

type ResultsResponse = {
  exam: Exam;
  school: School;
  subjects: Subject[];
  results: Result[];
};

const GRADES = ["A", "B", "C", "D", "F"] as const;
const DIVISIONS = ["DIV I", "DIV II", "DIV III", "DIV IV", "DIV 0", "Incomplete"];
const inputClass =
  "min-h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-base text-slate-800 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-400/20 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

function gradeFor(percentage: number) {
  const mark = Math.floor(percentage);
  if (mark >= 75) return "A";
  if (mark >= 65) return "B";
  if (mark >= 45) return "C";
  if (mark >= 30) return "D";
  return "F";
}

function pointsFor(grade: string) {
  return ({ A: 1, B: 2, C: 3, D: 4, F: 5 } as Record<string, number>)[grade] ?? null;
}

function divisionFor(points: number) {
  if (points >= 7 && points <= 17) return "DIV I";
  if (points >= 18 && points <= 21) return "DIV II";
  if (points >= 22 && points <= 25) return "DIV III";
  if (points >= 26 && points <= 33) return "DIV IV";
  return "DIV 0";
}

function competencyFor(gpa: number | null) {
  if (gpa === null) return "—";
  if (gpa < 1.5) return "Excellent";
  if (gpa < 1.8) return "Very Good";
  if (gpa < 2.3) return "Good";
  if (gpa < 3) return "Average";
  return "Unsatisfactory";
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

export function ExamResultsPage({
  examId,
  examsHref,
}: {
  examId: string;
  examsHref: string;
}) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(examId);
  const [classFilter, setClassFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [examListLoaded, setExamListLoaded] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("All");
  const [sexFilter, setSexFilter] = useState("All");
  const [darkMode, setDarkMode] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setGeneratedAt(
          new Date().toLocaleString("en-TZ", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!exam) return;
    const previousTitle = document.title;
    document.title = safeFileName(
      [exam.name, exam.class_form, exam.academic_year].filter(Boolean).join(" - "),
    );
    return () => {
      document.title = previousTitle;
    };
  }, [exam]);

  useEffect(() => {
    let active = true;
    async function loadExams() {
      try {
        const response = await fetch("/api/exams?pageSize=100");
        const body = (await response.json()) as { exams?: Exam[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load examinations.");
        if (!active) return;
        const processed = (body.exams ?? []).filter((item) => item.status === "Processed");
        setExams(processed);
        const selected = processed.find((item) => item.id === examId) ?? processed[0];
        if (selected) {
          setSelectedExamId(selected.id);
          setClassFilter(selected.class_form);
          setYearFilter(selected.academic_year);
        } else {
          setLoading(false);
          setError("No processed examinations to display.");
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load examinations.");
          setLoading(false);
        }
      } finally {
        if (active) setExamListLoaded(true);
      }
    }
    void loadExams();
    return () => {
      active = false;
    };
  }, [examId]);

  useEffect(() => {
    if (!selectedExamId || !examListLoaded) return;
    let active = true;
    async function loadResults() {
      try {
        const response = await fetch(`/api/exams/${selectedExamId}/results`);
        const body = (await response.json()) as Partial<ResultsResponse> & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load results.");
        if (!body.exam || !body.school || !body.subjects || !body.results) {
          throw new Error("Report data is incomplete.");
        }
        if (active) {
          setExam(body.exam);
          setSchool(body.school);
          setSubjects(body.subjects);
          setResults(body.results);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load results.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadResults();
    return () => {
      active = false;
    };
  }, [examListLoaded, selectedExamId]);

  const classOptions = useMemo(
    () => [...new Set(exams.map((item) => item.class_form))].sort(),
    [exams],
  );
  const yearOptions = useMemo(
    () => [...new Set(exams.map((item) => item.academic_year))].sort((a, b) => b.localeCompare(a)),
    [exams],
  );
  const availableExams = useMemo(
    () =>
      exams.filter(
        (item) =>
          (!classFilter || item.class_form === classFilter) &&
          (!yearFilter || item.academic_year === yearFilter),
      ),
    [classFilter, exams, yearFilter],
  );

  const reportRows = useMemo(() => {
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const computed = results.map((result) => {
      const breakdown = result.subject_breakdown
        .map((entry): ReportSubjectResult => {
          const metadata = subjectById.get(entry.subject_id);
          const hasPractical = Boolean(
            exam?.has_practical &&
              (metadata?.has_practical ?? entry.has_practical ?? false),
          );
          const absent = Boolean(entry.absent);
          const missing = Boolean(
            entry.missing ??
              (!absent &&
                (entry.theory === null ||
                  entry.theory === undefined ||
                  (hasPractical && entry.practical === null))),
          );
          const score =
            absent || missing || entry.theory === null
              ? null
              : Number(entry.theory) + (hasPractical ? Number(entry.practical ?? 0) : 0);
          const maximum = hasPractical ? 150 : 100;
          const percentage =
            score === null ? null : Math.round((score / maximum) * 10000) / 100;
          const grade = percentage === null ? (absent ? "ABS" : "—") : gradeFor(percentage);
          return {
            ...entry,
            subject: metadata?.name ?? entry.subject,
            code: metadata?.subject_code ?? entry.code ?? "",
            has_practical: hasPractical,
            total: score,
            percentage,
            grade,
            points: pointsFor(grade),
            absent,
            missing,
          };
        })
        .sort((a, b) =>
          `${a.code || a.subject}`.localeCompare(`${b.code || b.subject}`),
        );
      const sat = breakdown.filter(
        (subject) => !subject.absent && !subject.missing && subject.percentage !== null,
      );
      const average =
        sat.length > 0
          ? Math.round(
              (sat.reduce((sum, subject) => sum + (subject.percentage ?? 0), 0) /
                sat.length) *
                100,
            ) / 100
          : null;
      const points = sat
        .map((subject) => subject.points)
        .filter((point): point is number => point !== null)
        .sort((a, b) => a - b)
        .slice(0, 7)
        .reduce((sum, point) => sum + point, 0);
      const isIncomplete =
        result.is_incomplete || breakdown.some((subject) => subject.missing);
      return {
        ...result,
        subject_breakdown: breakdown,
        average,
        grade: average === null ? "—" : gradeFor(average),
        points,
        division: isIncomplete ? "Incomplete" : divisionFor(points),
        is_incomplete: isIncomplete,
        position: null as number | null,
      };
    });
    computed.sort(
      (a, b) =>
        (b.average ?? -1) - (a.average ?? -1) ||
        a.points - b.points ||
        (a.student?.full_name ?? "").localeCompare(b.student?.full_name ?? ""),
    );
    let previousAverage: number | null = null;
    let previousPosition = 0;
    return computed.map((result, index) => {
      const position =
        result.average !== null && result.average === previousAverage
          ? previousPosition
          : result.average === null
            ? null
            : index + 1;
      if (result.average !== null) {
        previousAverage = result.average;
        previousPosition = position ?? index + 1;
      }
      return { ...result, position };
    });
  }, [exam?.has_practical, results, subjects]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reportRows.filter((row) => {
      const matchesSearch = !query || (row.student?.full_name ?? "").toLowerCase().includes(query);
      const matchesDivision = divisionFilter === "All" || row.division === divisionFilter;
      const matchesSex = sexFilter === "All" || row.student?.sex === sexFilter;
      return matchesSearch && matchesDivision && matchesSex;
    });
  }, [divisionFilter, reportRows, search, sexFilter]);

  const divisionSummary = useMemo(
    () =>
      DIVISIONS.map((division) => {
        const students = reportRows.filter((row) => row.division === division);
        return {
          division,
          girls: students.filter((row) => row.student?.sex === "F").length,
          boys: students.filter((row) => row.student?.sex === "M").length,
          total: students.length,
        };
      }),
    [reportRows],
  );

  const averageStats = useMemo(() => {
    const averages = reportRows
      .map((row) => row.average)
      .filter((value): value is number => value !== null);
    const average =
      averages.length > 0
        ? Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 100) / 100
        : null;
    const gpas = reportRows.map((row) => row.points);
    const gpa =
      gpas.length > 0
        ? Math.round((gpas.reduce((sum, value) => sum + value, 0) / gpas.length) * 100) / 100
        : null;
    return { average, grade: average === null ? "—" : gradeFor(average), gpa };
  }, [reportRows]);

  const subjectPerformance = useMemo(() => {
    const summaries: SubjectPerformance[] = subjects.map((subject) => {
      const entries = reportRows.flatMap((student) => {
        const result = student.subject_breakdown.find((item) => item.subject_id === subject.id);
        return result && !result.absent && !result.missing && result.percentage !== null
          ? [{ student, result }]
          : [];
      });
      const percentages = entries.map(({ result }) => result.percentage ?? 0);
      const average =
        percentages.length > 0
          ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 100) / 100
          : null;
      const grade = average === null ? "—" : gradeFor(average);
      const points = entries
        .map(({ result }) => result.points)
        .filter((value): value is number => value !== null);
      const gpa =
        points.length > 0
          ? Math.round((points.reduce((sum, value) => sum + value, 0) / points.length) * 100) / 100
          : null;
      const grades = Object.fromEntries(
        GRADES.map((item) => [
          item,
          {
            F: entries.filter(({ student, result }) => student.student?.sex === "F" && result.grade === item).length,
            M: entries.filter(({ student, result }) => student.student?.sex === "M" && result.grade === item).length,
            T: entries.filter(({ result }) => result.grade === item).length,
          },
        ]),
      ) as SubjectPerformance["grades"];
      return {
        subject,
        average,
        grade,
        gpa,
        competency: competencyFor(gpa),
        sat: entries.length,
        pass: entries.filter(({ result }) => result.grade !== "F").length,
        grades,
      };
    });
    return summaries.sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.subject.name.localeCompare(b.subject.name));
  }, [reportRows, subjects]);

  function chooseExam(nextExamId: string) {
    const next = exams.find((item) => item.id === nextExamId);
    if (next) {
      setClassFilter(next.class_form);
      setYearFilter(next.academic_year);
      setSelectedExamId(next.id);
      setLoading(true);
      setError("");
    }
  }

  function chooseClass(nextClass: string) {
    const matching = exams.filter(
      (item) => item.class_form === nextClass && (!yearFilter || item.academic_year === yearFilter),
    );
    const choices = matching.length
      ? matching
      : exams.filter((item) => item.class_form === nextClass);
    if (choices[0]) {
      setClassFilter(nextClass);
      setYearFilter(choices[0].academic_year);
      setSelectedExamId(choices[0].id);
      setLoading(true);
      setError("");
    }
  }

  function chooseYear(nextYear: string) {
    const matching = exams.filter(
      (item) => item.academic_year === nextYear && (!classFilter || item.class_form === classFilter),
    );
    const choices = matching.length
      ? matching
      : exams.filter((item) => item.academic_year === nextYear);
    if (choices[0]) {
      setYearFilter(nextYear);
      setClassFilter(choices[0].class_form);
      setSelectedExamId(choices[0].id);
      setLoading(true);
      setError("");
    }
  }

  function reportFileBaseName() {
    return (
      safeFileName(
        [exam?.name, exam?.class_form, exam?.academic_year]
          .filter(Boolean)
          .join(" - "),
      ) || "Results Report"
    );
  }

  function printReport() {
    if (exam) {
      document.title = reportFileBaseName();
    }
    window.print();
  }

  function exportExcel() {
    const header = [
      [school?.school_name ?? "", school?.district ?? "", exam?.name ?? "", exam?.class_form ?? "", exam?.academic_year ?? ""],
      [],
      ["STUDENTS' RESULTS"],
      ["#", "STUDENT NAME", "SEX", "AVG", "GRADE", "PTS", "DIV", "SUBJECTS (GRADES)"],
      ...filteredRows.map((row) => [
        row.position ?? "",
        row.student?.full_name ?? "",
        row.student?.sex ?? "",
        row.average ?? "",
        row.grade,
        row.points,
        row.division,
        row.subject_breakdown.map((subject) => `${subject.code || subject.subject}-${subject.grade}`).join(", "),
      ]),
      [],
      ["SUBJECT PERFORMANCE SUMMARY"],
      ["#", "SUBJECT", ...GRADES.flatMap((grade) => [`${grade} F`, `${grade} M`, `${grade} T`]), "AVG", "GRADE", "REG", "SAT", "PASS", "GPA", "COMPETENCY"],
      ...subjectPerformance.map((item, index) => [
        index + 1,
        `${item.subject.subject_code} — ${item.subject.name}`,
        ...GRADES.flatMap((grade) => [item.grades[grade].F, item.grades[grade].M, item.grades[grade].T]),
        item.average ?? "",
        item.grade,
        item.subject.registered,
        item.sat,
        item.pass,
        item.gpa ?? "",
        item.competency,
      ]),
    ];
    const csv = `\uFEFF${header.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportFileBaseName()}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("success", "Excel (CSV) report downloaded.");
  }

  const reportDate = exam?.start_date
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })
        .format(new Date(`${exam.start_date}T00:00:00`))
        .toUpperCase()
    : exam?.academic_year ?? "";
  const address = school?.address?.trim() ?? "";
  const postalBox = address.match(
    /(?:p\.?\s*o\.?\s*box|s\.?\s*l\.?\s*p\.?)\s*[:#-]?\s*(.+)/i,
  );
  const addressLine = address
    ? `P.O. Box ${postalBox?.[1]?.trim() ?? address}`
    : "P.O. Box —";

  return (
    <div
      data-theme={darkMode ? "dark" : "light"}
      className="exam-report mx-auto w-full min-w-0 max-w-[1600px] space-y-3 overflow-x-clip text-slate-900 dark:bg-slate-950 dark:text-slate-100"
    >
      <div className="report-no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={examsHref}
          className="inline-flex min-h-9 items-center gap-2 rounded px-1 text-sm font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exams
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDarkMode((value) => !value)}
            className="inline-flex min-h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      <section className="report-no-print grid gap-2 rounded border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-3">
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Class
          <select className={inputClass} value={classFilter} onChange={(event) => chooseClass(event.target.value)}>
            {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Year
          <select className={inputClass} value={yearFilter} onChange={(event) => chooseYear(event.target.value)}>
            {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Examination
          <select className={inputClass} value={selectedExamId} onChange={(event) => chooseExam(event.target.value)}>
            {availableExams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.term}</option>)}
          </select>
        </label>
      </section>

      {loading ? (
        <LoadingIndicator label="Loading results..." className="py-12" />
      ) : error ? (
        <div role="alert" className="rounded border border-slate-400 bg-slate-50 p-3 text-sm font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
          {error}
        </div>
      ) : !exam || !school ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm dark:border-slate-700 dark:bg-slate-900">
          No processed results available at the moment.
        </div>
      ) : (
        <>
          <header className="report-heading rounded border border-slate-300 border-t-2 border-t-slate-900 bg-white px-4 py-3 text-center dark:border-slate-700 dark:border-t-slate-300 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 sm:text-xs">
              COUNCIL / DISTRICT: {school.district || "—"}
            </p>
            <h1 className="mt-0.5 text-lg font-extrabold uppercase tracking-wide sm:text-xl">{school.school_name}</h1>
            <p className="text-xs text-slate-700 dark:text-slate-300">{addressLine}</p>
            <p className="mt-1 text-sm font-bold uppercase">{exam.name} — {reportDate}</p>
            <p className="text-sm font-semibold">{exam.class_form}</p>
          </header>

          <section className="report-division-layout grid min-w-0 gap-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
            <div className="report-division-summary min-w-0 overflow-hidden rounded border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <table className="report-division-table w-full table-fixed border-collapse text-center text-xs">
                <thead className="bg-slate-800 text-white dark:bg-slate-700">
                  <tr><th className="w-[28%] px-2 py-1.5 text-left">DIV</th><th className="px-1 py-1.5">BOYS</th><th className="px-1 py-1.5">GIRLS</th><th className="px-1 py-1.5">TOTAL</th></tr>
                </thead>
                <tbody>
                  {divisionSummary.map((item) => (
                    <tr key={item.division} className="border-t border-slate-200 odd:bg-slate-50 dark:border-slate-700 dark:odd:bg-slate-800/70">
                      <th className="px-3 py-1 text-left">{item.division.replace("DIV ", "")}</th>
                      <td className="px-3 py-1">{item.boys}</td><td className="px-3 py-1">{item.girls}</td><td className="px-3 py-1 font-bold">{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["AVERAGE (%)", averageStats.average === null ? "—" : `${averageStats.average.toFixed(2)}%`],
                ["AVERAGE GRADE", averageStats.grade],
                ["STUDENTS", String(reportRows.length)],
                ["SCHOOL GPA", averageStats.gpa === null ? "—" : averageStats.gpa.toFixed(2)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded border border-slate-300 border-l-2 border-l-slate-800 bg-white px-3 py-2 dark:border-slate-700 dark:border-l-slate-400 dark:bg-slate-900">
                  <p className="break-words text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-0.5 break-words text-lg font-extrabold text-slate-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="report-no-print flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student name" className={`${inputClass} pl-9`} />
              </label>
              <select aria-label="Filter by division" className={`${inputClass} sm:w-44`} value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)}>
                <option value="All">All divisions</option>
                {DIVISIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="Filter by sex" className={`${inputClass} sm:w-36`} value={sexFilter} onChange={(event) => setSexFilter(event.target.value)}>
                <option value="All">All sexes</option><option value="F">F</option><option value="M">M</option>
              </select>
            </div>
            <div className="report-scroll hidden min-w-0 max-h-[70vh] overflow-y-auto overflow-x-hidden rounded border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 md:block">
              <table className="report-students-table w-full table-fixed border-collapse text-left text-[11px] leading-4 sm:text-xs">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[18%]" />
                  <col className="w-[5%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[6%]" />
                  <col className="w-[7%]" />
                  <col className="w-[43%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-800 text-white dark:bg-slate-700">
                  <tr>
                    {["#", "STUDENT NAME", "SEX", "AVG", "GRADE", "PTS", "DIV", "SUBJECTS (GRADES)"].map((label) => (
                      <th key={label} className="break-words px-1 py-1.5 font-bold uppercase sm:px-2">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.student_id} className="border-t border-slate-200 odd:bg-slate-50 dark:border-slate-700 dark:odd:bg-slate-800/60">
                      <td className="px-2 py-1 font-bold">{row.position ?? "—"}</td>
                      <td className="break-words px-1 py-1 font-semibold sm:px-2">{row.student?.full_name ?? "Student"}</td>
                      <td className="px-1 py-1">{row.student?.sex ?? "—"}</td>
                      <td className="px-1 py-1">{row.average === null ? "—" : row.average.toFixed(2)}</td>
                      <td className="px-1 py-1 font-bold">{row.grade}</td>
                      <td className="px-1 py-1">{row.points}</td>
                      <td className="px-1 py-1 font-bold">{row.division.replace("DIV ", "")}</td>
                      <td className="px-1 py-1 sm:px-2">
                        <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
                          {row.subject_breakdown.filter((subject) => !subject.missing).map((subject) => (
                            <span key={subject.subject_id} title={`${subject.subject}: ${subject.grade}`} className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                              {subject.code || subject.subject}-{subject.grade}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No results match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="report-students-cards space-y-2 md:hidden">
              {filteredRows.map((row) => (
                <article key={row.student_id} className="min-w-0 rounded border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        #{row.position ?? "—"} · {row.student?.sex ?? "—"}
                      </p>
                      <h3 className="break-words text-sm font-bold leading-tight">{row.student?.full_name ?? "Student"}</h3>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-extrabold leading-none">{row.average === null ? "—" : row.average.toFixed(2)}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Average</p>
                    </div>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 pb-1.5 text-center dark:divide-slate-700 dark:border-slate-700">
                    <div>
                      <dt className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Grade</dt>
                      <dd className="text-[11px] font-bold">{row.grade}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Points</dt>
                      <dd className="text-[11px] font-bold">{row.points}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Division</dt>
                      <dd className="text-[11px] font-bold">{row.division.replace("DIV ", "")}</dd>
                    </div>
                  </dl>
                  <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                    {row.subject_breakdown.filter((subject) => !subject.missing).map((subject) => (
                      <span key={subject.subject_id} title={`${subject.subject}: ${subject.grade}`} className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                        {subject.code || subject.subject}-{subject.grade}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
              {filteredRows.length === 0 && (
                <p className="rounded border border-slate-300 bg-white p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  No results match your search.
                </p>
              )}
            </div>
          </section>

          <section className="report-summary-section space-y-2">
            <h2 className="border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide dark:border-slate-700">Subject Performance Summary</h2>
            <div className="report-scroll hidden min-w-0 max-h-[70vh] overflow-y-auto overflow-x-hidden rounded border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 2xl:block">
              <table className="report-summary-table w-full table-fixed border-collapse text-center text-[9px] leading-3">
                <colgroup>
                  <col className="w-[3%]" />
                  <col className="w-[17%]" />
                  {GRADES.map((grade) => (
                    <Fragment key={grade}>
                      <col className="w-[2.9%]" />
                      <col className="w-[2.9%]" />
                      <col className="w-[2.9%]" />
                    </Fragment>
                  ))}
                  <col className="w-[5%]" />
                  <col className="w-[4%]" />
                  <col className="w-[4%]" />
                  <col className="w-[4%]" />
                  <col className="w-[4%]" />
                  <col className="w-[4%]" />
                  <col className="w-[11.5%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-800 text-white dark:bg-slate-700">
                  <tr>
                    <th rowSpan={2} className="px-0.5 py-1">#</th>
                    <th rowSpan={2} className="px-1 py-1 text-left">SUBJECT</th>
                    {GRADES.map((grade) => (
                      <th key={grade} colSpan={3} className="border-l border-slate-600 px-0.5 py-1 dark:border-slate-500">{grade}</th>
                    ))}
                    <th rowSpan={2} className="border-l border-slate-600 px-0.5 py-1 dark:border-slate-500">AVG</th>
                    <th rowSpan={2} className="px-0.5 py-1">GRADE</th>
                    <th rowSpan={2} className="px-0.5 py-1">REG</th>
                    <th rowSpan={2} className="px-0.5 py-1">SAT</th>
                    <th rowSpan={2} className="px-0.5 py-1">PASS</th>
                    <th rowSpan={2} className="px-0.5 py-1">GPA</th>
                    <th rowSpan={2} className="px-0.5 py-1">COMPETENCY</th>
                  </tr>
                  <tr>
                    {GRADES.map((grade) => (
                      <Fragment key={grade}>
                        <th className="border-l border-slate-600 px-0.5 py-0.5 text-[8px] font-normal dark:border-slate-500">F</th>
                        <th className="px-0.5 py-0.5 text-[8px] font-normal">M</th>
                        <th className="px-0.5 py-0.5 text-[8px] font-normal">T</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjectPerformance.map((item, index) => (
                    <tr key={item.subject.id} className="border-t border-slate-200 odd:bg-slate-50 dark:border-slate-700 dark:odd:bg-slate-800/60">
                      <td className="px-0.5 py-1">{index + 1}</td>
                      <td className="break-words px-1 py-1 text-left font-semibold">{item.subject.subject_code} — {item.subject.name}</td>
                      {GRADES.map((grade) => (
                        <Fragment key={grade}>
                          <td className="border-l border-slate-200 px-0.5 py-1 dark:border-slate-700">{item.grades[grade].F}</td>
                          <td className="px-0.5 py-1">{item.grades[grade].M}</td>
                          <td className="px-0.5 py-1">{item.grades[grade].T}</td>
                        </Fragment>
                      ))}
                      <td className="border-l border-slate-200 px-0.5 py-1 dark:border-slate-700">{item.average === null ? "—" : item.average.toFixed(2)}</td>
                      <td className="px-0.5 py-1 font-bold">{item.grade}</td>
                      <td className="px-0.5 py-1">{item.subject.registered}</td>
                      <td className="px-0.5 py-1">{item.sat}</td>
                      <td className="px-0.5 py-1">{item.pass}</td>
                      <td className="px-0.5 py-1">{item.gpa === null ? "—" : item.gpa.toFixed(2)}</td>
                      <td className="break-words px-0.5 py-1 font-semibold">{item.competency}</td>
                    </tr>
                  ))}
                  {subjectPerformance.length === 0 && <tr><td colSpan={24} className="px-4 py-6 text-slate-500">No subjects for this examination.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="report-subject-cards grid min-w-0 gap-2 2xl:hidden">
              {subjectPerformance.map((item, index) => (
                <article key={item.subject.id} className="min-w-0 rounded border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex min-w-0 items-start justify-between gap-2 border-b border-slate-200 pb-1.5 dark:border-slate-700">
                    <h3 className="min-w-0 break-words text-sm font-bold">
                      <span className="mr-1 text-slate-500">{index + 1}.</span>
                      {item.subject.subject_code} — {item.subject.name}
                    </h3>
                    <span className="shrink-0 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{item.competency}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-4">
                    <p><span className="text-slate-500">AVG:</span> {item.average === null ? "—" : `${item.average.toFixed(2)}%`}</p>
                    <p><span className="text-slate-500">GRADE:</span> {item.grade}</p>
                    <p><span className="text-slate-500">REG:</span> {item.subject.registered}</p>
                    <p><span className="text-slate-500">SAT:</span> {item.sat}</p>
                    <p><span className="text-slate-500">PASS:</span> {item.pass}</p>
                    <p><span className="text-slate-500">GPA:</span> {item.gpa === null ? "—" : item.gpa.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-200 pt-1.5 dark:border-slate-700 sm:grid-cols-5">
                    {GRADES.map((grade) => (
                      <div key={grade} className="min-w-0 text-center text-[10px]">
                        <p className="mb-0.5 font-bold">{grade}</p>
                        <p className="break-words text-slate-600 dark:text-slate-300">
                          F {item.grades[grade].F} · M {item.grades[grade].M} · T {item.grades[grade].T}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
              {subjectPerformance.length === 0 && (
                <p className="rounded border border-slate-300 bg-white p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  No subjects for this examination.
                </p>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              COMPETENCY levels are estimates; verify against official school/NECTA guidelines.
            </p>
          </section>
        </>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 pt-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span>Generated: {generatedAt || "—"}</span>
        <span>School report · {school?.school_name ?? ""}</span>
        <div className="report-no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={printReport}
            className="inline-flex min-h-9 items-center gap-2 rounded bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-900"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={loading || !results.length}
            className="inline-flex min-h-9 items-center gap-2 rounded border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </footer>
    </div>
  );
}
