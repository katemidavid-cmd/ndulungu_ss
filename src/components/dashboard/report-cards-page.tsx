"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Moon, PenLine, Printer, Sun } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import {
  ReportCardSignatures,
  SignatureManager,
} from "@/components/dashboard/report-card-signatures";
import { notify } from "@/lib/notifications";
import { commentForAverage } from "@/lib/report-card-comments";
import type { SchoolSignatures } from "@/lib/report-card-signatures";

type ExamStatus = "Draft" | "Active" | "Processed";

type Exam = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: ExamStatus;
  created_at: string;
};

type School = SchoolSignatures & {
  school_name: string;
  district: string;
  region: string;
  address: string;
};

type SubjectMeta = {
  id: string;
  name: string;
  subject_code: string;
};

type SubjectBreakdownEntry = {
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

type StoredResult = {
  exam_id: string;
  student_id: string;
  average: number | null;
  grade: string | null;
  division: string | null;
  points: number | null;
  position: number | null;
  is_incomplete: boolean | null;
  subject_breakdown?: SubjectBreakdownEntry[] | null;
};

type Student = {
  id: string;
  full_name: string;
  sex: "M" | "F";
  admission_no: string | null;
  form: string | null;
  stream: string | null;
};

type ReportData = {
  exam: Exam;
  school: School;
  exams: Exam[];
  students: Student[];
  subjects: SubjectMeta[];
  results: Record<string, Record<string, StoredResult>>;
};

type SubjectRow = {
  id: string;
  name: string;
  mark: number;
  grade: string;
  points: number;
  remark: string;
};

type TrendKind = "up" | "down" | "same" | "none";

type HistoryRow = {
  exam: Exam;
  date: string;
  average: number | null;
  position: number | null;
  grade: string | null;
  points: number | null;
  trend: TrendKind;
};

const GRADE_POINTS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, F: 5 };
const GRADE_REMARKS: Record<string, string> = {
  A: "Bora",
  B: "Nzuri Sana",
  C: "Nzuri",
  D: "Inaridhisha",
  F: "Inahitaji Kuboreshwa",
};
const GRADE_CELL_CLASS: Record<string, string> = {
  A: "grade-a bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  B: "grade-b bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100",
  C: "grade-c bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100",
  D: "grade-d bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
  F: "grade-f bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100",
};
const TREND_DISPLAY: Record<TrendKind, { text: string; className: string }> = {
  up: { text: "▲ Imeboreka", className: "trend-up text-green-700 dark:text-green-400" },
  down: { text: "▼ Imepungua", className: "trend-down text-red-700 dark:text-red-400" },
  same: { text: "— Hakuna mabadiliko", className: "trend-same text-slate-500 dark:text-slate-400" },
  none: { text: "—", className: "trend-none text-slate-500 dark:text-slate-400" },
};
const BEHAVIOUR_ITEMS = [
  "Bidii katika kazi",
  "Heshima na kuthamini wajibu",
  "Kutunza mali za umma",
  "Uelewa na ushirikiano",
  "Heshima kwa walimu na wanafunzi",
  "Kutii na kufuata maelekezo",
  "Usafi binafsi",
  "Kushiriki katika shughuli za kitamaduni",
];
const SWAHILI_MONTHS = [
  "Januari",
  "Februari",
  "Machi",
  "Aprili",
  "Mei",
  "Juni",
  "Julai",
  "Agosti",
  "Septemba",
  "Oktoba",
  "Novemba",
  "Desemba",
];
const SWAHILI_SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mac",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const inputClass =
  "min-h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-base text-slate-800 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-400/20 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

function gradeFor(mark: number) {
  if (mark >= 75) return "A";
  if (mark >= 65) return "B";
  if (mark >= 45) return "C";
  if (mark >= 30) return "D";
  return "F";
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(Number(value).toFixed(2)).toString();
}

function formatAverage(value: number | null | undefined) {
  const score = formatScore(value);
  return score === "—" ? score : `${score}%`;
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateSlash(value: string) {
  const date = parseDate(value);
  if (!date) return value || "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatShortMonthYear(value: string) {
  const date = parseDate(value);
  if (!date) return value || "—";
  return `${SWAHILI_SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatSwahiliDate(date: Date) {
  return `${date.getDate()} ${SWAHILI_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function postalLine(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return "S.L.P. —";
  const match = trimmed.match(
    /(?:p\.?\s*o\.?\s*box|s\.?\s*l\.?\s*p\.?)\s*[:#-]?\s*(.+)/i,
  );
  return `S.L.P. ${match?.[1]?.trim() || trimmed}`;
}

function divisionText(division: string | null) {
  if (!division) return "—";
  const cleaned = division.replace(/^DIV\s*/i, "").trim();
  if (!cleaned || cleaned.toLowerCase() === "incomplete") return "—";
  return cleaned;
}

function trendFor(current: number | null, older: number | null): TrendKind {
  if (current === null || older === null) return "none";
  const difference = Math.round((current - older) * 100) / 100;
  if (difference > 0) return "up";
  if (difference < 0) return "down";
  return "same";
}

function sortExamsNewestFirst(a: Exam, b: Exam) {
  return b.start_date.localeCompare(a.start_date) || b.created_at.localeCompare(a.created_at);
}

function subjectsFor(result: StoredResult, subjects: SubjectMeta[]): SubjectRow[] {
  const namesById = new Map(subjects.map((subject) => [subject.id, subject.name]));
  return (result.subject_breakdown ?? [])
    .filter(
      (entry) =>
        !entry.absent && !entry.missing && entry.percentage !== null && entry.percentage !== undefined,
    )
    .map((entry) => {
      const mark = entry.percentage ?? 0;
      const grade = gradeFor(mark);
      return {
        id: entry.subject_id,
        name: namesById.get(entry.subject_id) ?? entry.subject,
        mark,
        grade,
        points: GRADE_POINTS[grade],
        remark: GRADE_REMARKS[grade],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "sw"));
}

function historyFor(
  exam: Exam,
  exams: Exam[],
  results: Record<string, Record<string, StoredResult>>,
  studentId: string,
  previousCount: number,
): HistoryRow[] {
  const selectedIndex = exams.findIndex((item) => item.id === exam.id);
  if (selectedIndex < 0) {
    const result = results[exam.id]?.[studentId];
    return [
      {
        exam,
        date: formatDateSlash(exam.start_date),
        average: result?.average ?? null,
        position: result?.position ?? null,
        grade: result?.grade ?? null,
        points: result?.points ?? null,
        trend: "none",
      },
    ];
  }

  const displayed = exams.slice(selectedIndex, selectedIndex + previousCount + 1);
  return displayed.map((historyExam, index) => {
    const result = results[historyExam.id]?.[studentId];
    const nextOlderExam = exams[selectedIndex + index + 1];
    const olderResult = nextOlderExam
      ? results[nextOlderExam.id]?.[studentId]
      : null;
    return {
      exam: historyExam,
      date: formatDateSlash(historyExam.start_date),
      average: result?.average ?? null,
      position: result?.position ?? null,
      grade: result?.grade ?? null,
      points: result?.points ?? null,
      trend: trendFor(result?.average ?? null, olderResult?.average ?? null),
    };
  });
}

function buildParentParagraph(
  student: Student,
  exam: Exam,
  result: StoredResult,
  totalStudents: number,
) {
  const firstName = student.full_name.trim().split(/\s+/)[0] || student.full_name;
  const position = result.position === null ? "—" : String(result.position);
  const total = totalStudents > 0 ? String(totalStudents) : "—";
  return `MZAZI/MLEZI WA ${student.full_name.toUpperCase()}, KATIKA MTIHANI WA ${exam.name.toUpperCase()} ${exam.academic_year}, ${firstName.toUpperCase()} AMESHIKA NAFASI YA ${position} KATI YA WANAFUNZI ${total} WALIOFANYA MTIHANI, AKIWA NA WASTANI WA ${formatScore(result.average)}%, DIVISENI ${divisionText(result.division)} ZA POINTI ${result.points ?? "—"}. ASANTE.`;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

export function ReportCardsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const [previousCount, setPreviousCount] = useState(2);
  const [data, setData] = useState<ReportData | null>(null);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [showSignatureManager, setShowSignatureManager] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadExams() {
      try {
        const response = await fetch("/api/exams?pageSize=100");
        const body = (await response.json()) as { exams?: Exam[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load examinations.");
        if (!active) return;
        const processed = (body.exams ?? [])
          .filter((item) => item.status === "Processed")
          .sort(sortExamsNewestFirst);
        setExams(processed);
        const first = processed[0];
        if (first) {
          setClassFilter(first.class_form);
          setYearFilter(first.academic_year);
          setLoadingReport(true);
          setSelectedExamId(first.id);
        } else {
          setError("No processed examinations are available.");
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load examinations.",
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
    if (!selectedExamId) return;
    let active = true;
    async function loadReport() {
      try {
        const response = await fetch(
          `/api/report-cards?examId=${encodeURIComponent(selectedExamId)}`,
        );
        const body = (await response.json()) as Partial<ReportData> & { error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load report cards.");
        if (
          !body.exam ||
          !body.school ||
          !body.exams ||
          !body.students ||
          !body.subjects ||
          !body.results
        ) {
          throw new Error("Report card data is incomplete.");
        }
        if (!active) return;
        setData(body as ReportData);
        setReportDate(formatSwahiliDate(new Date()));
        setError("");
        setStudentFilter((current) =>
          current !== "all" && !body.students?.some((student) => student.id === current)
            ? "all"
            : current,
        );
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load report cards.",
          );
        }
      } finally {
        if (active) setLoadingReport(false);
      }
    }
    void loadReport();
    return () => {
      active = false;
    };
  }, [selectedExamId]);

  function updateSchoolSignatures(signatures: SchoolSignatures) {
    setData((current) =>
      current
        ? { ...current, school: { ...current.school, ...signatures } }
        : current,
    );
  }

  const classOptions = useMemo(
    () => [...new Set(exams.map((item) => item.class_form))].sort((a, b) => a.localeCompare(b)),
    [exams],
  );
  const yearOptions = useMemo(() => {
    const scoped = exams.filter((item) => !classFilter || item.class_form === classFilter);
    return [...new Set(scoped.map((item) => item.academic_year))].sort((a, b) =>
      b.localeCompare(a),
    );
  }, [classFilter, exams]);
  const examOptions = useMemo(
    () =>
      exams
        .filter(
          (item) =>
            (!classFilter || item.class_form === classFilter) &&
            (!yearFilter || item.academic_year === yearFilter),
        )
        .sort(sortExamsNewestFirst),
    [classFilter, exams, yearFilter],
  );
  const studentOptions = useMemo(
    () =>
      [...(data?.students ?? [])].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, "sw"),
      ),
    [data],
  );
  const selectedExamResults = useMemo(
    () => (data ? data.results[data.exam.id] ?? {} : {}),
    [data],
  );
  const totalStudents = useMemo(
    () => Object.values(selectedExamResults).filter((result) => result.average !== null).length,
    [selectedExamResults],
  );
  const cards = useMemo(() => {
    if (!data) return [];
    return data.students
      .filter((student) => studentFilter === "all" || student.id === studentFilter)
      .sort((a, b) => {
        const positionA = selectedExamResults[a.id]?.position ?? Number.MAX_SAFE_INTEGER;
        const positionB = selectedExamResults[b.id]?.position ?? Number.MAX_SAFE_INTEGER;
        return positionA - positionB || a.full_name.localeCompare(b.full_name, "sw");
      });
  }, [data, selectedExamResults, studentFilter]);

  function selectExam(nextExamId: string) {
    if (!nextExamId || nextExamId === selectedExamId) return;
    setLoadingReport(true);
    setError("");
    setData(null);
    setSelectedExamId(nextExamId);
  }

  function chooseClass(nextClass: string) {
    const matching = exams
      .filter((item) => item.class_form === nextClass)
      .sort(sortExamsNewestFirst);
    const preferred =
      matching.find((item) => item.academic_year === yearFilter) ?? matching[0];
    setClassFilter(nextClass);
    if (preferred) {
      setYearFilter(preferred.academic_year);
      selectExam(preferred.id);
    }
  }

  function chooseYear(nextYear: string) {
    const matching = exams
      .filter(
        (item) =>
          (!classFilter || item.class_form === classFilter) &&
          item.academic_year === nextYear,
      )
      .sort(sortExamsNewestFirst);
    setYearFilter(nextYear);
    if (matching[0]) selectExam(matching[0].id);
  }

  function chooseExam(nextExamId: string) {
    const next = exams.find((item) => item.id === nextExamId);
    if (next) {
      setClassFilter(next.class_form);
      setYearFilter(next.academic_year);
    }
    selectExam(nextExamId);
  }

  function printReport() {
    if (!data) return;
    document.title = safeFileName(
      `Ripoti - ${data.exam.name} - ${data.exam.class_form} - ${data.exam.academic_year}`,
    );
    window.print();
  }

  function exportExcel() {
    if (!data || cards.length === 0) return;
    const rows: (string | number)[][] = [
      [data.school.school_name],
      [`HALMASHAURI YA WILAYA YA ${data.school.district || data.school.region || "—"}`],
      [`RIPOTI YA MATOKEO — ${data.exam.name} ${data.exam.academic_year}`],
      [`Darasa: ${data.exam.class_form}`, `Tarehe: ${reportDate || "—"}`],
      [],
      [
        "NAFASI",
        "JINA",
        "JINSIA",
        "MKONDO",
        "WASTANI",
        "DARAJA",
        "POINTI",
        "DIVISENI",
        "MASOMO",
        "HISTORIA YA MITIHANI",
        "MAONI MKUU WA SHULE",
        "MAONI MWALIMU WA TAALUMA",
        "MAONI MWALIMU WA DARASA",
        "MAZUNGUMZO YA MZAZI/MLEZI",
      ],
    ];

    for (const student of cards) {
      const result = selectedExamResults[student.id];
      if (!result) continue;
      const subjectRows = subjectsFor(result, data.subjects);
      const history = historyFor(
        data.exam,
        data.exams,
        data.results,
        student.id,
        previousCount,
      );
      rows.push([
        result.position ?? "—",
        student.full_name,
        student.sex,
        student.stream ?? "—",
        formatAverage(result.average),
        result.grade ?? "—",
        result.points ?? "—",
        divisionText(result.division),
        subjectRows
          .map((subject) => `${subject.name}: ${formatScore(subject.mark)}% (${subject.grade}, ${subject.points})`)
          .join("; "),
        history
          .map(
            (row) =>
              `${row.exam.name} (${formatAverage(row.average)}, Nafasi ${row.position ?? "—"}, ${row.grade ?? "—"}, Pts ${row.points ?? "—"})`,
          )
          .join("; "),
        commentForAverage(result.average, "headmaster", student.id),
        commentForAverage(result.average, "subjectTeacher", student.id),
        commentForAverage(result.average, "classTeacher", student.id),
        buildParentParagraph(student, data.exam, result, totalStudents),
      ]);
    }

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(
      `Ripoti ya Matokeo - ${data.exam.name} - ${data.exam.class_form} - ${data.exam.academic_year}`,
    )}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("success", "Excel (CSV) report downloaded.");
  }

  return (
    <div
      data-theme={darkMode ? "dark" : "light"}
      className="exam-report report-card-page mx-auto w-full min-w-0 max-w-[210mm] space-y-4 text-slate-900 dark:text-slate-100"
    >
      <div className="report-no-print flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Ripoti ya Matokeo</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Report cards · one A4 page per student
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDarkMode((value) => !value)}
            className="inline-flex min-h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>

        <div className="grid gap-2 rounded border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Class
            <select
              className={inputClass}
              value={classFilter}
              onChange={(event) => chooseClass(event.target.value)}
              disabled={loadingExams}
            >
              {classOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Exam
            <select
              className={inputClass}
              value={selectedExamId}
              onChange={(event) => chooseExam(event.target.value)}
              disabled={loadingExams}
            >
              {examOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.term}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Year
            <select
              className={inputClass}
              value={yearFilter}
              onChange={(event) => chooseYear(event.target.value)}
              disabled={loadingExams}
            >
              {yearOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Student
            <select
              className={inputClass}
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              disabled={!data || loadingReport}
            >
              <option value="all">All students</option>
              {studentOptions.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Previous exams to show
            <select
              className={inputClass}
              value={previousCount}
              onChange={(event) =>
                setPreviousCount(Math.min(3, Math.max(0, Number(event.target.value))))
              }
            >
              {[0, 1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={printReport}
            disabled={!data || loadingReport || cards.length === 0}
            className="inline-flex min-h-9 items-center gap-2 rounded bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!data || loadingReport || cards.length === 0}
            className="inline-flex min-h-9 items-center gap-2 rounded border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => setShowSignatureManager((value) => !value)}
            disabled={!data || loadingReport}
            className="inline-flex min-h-9 items-center gap-2 rounded border border-emerald-500 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-600 dark:bg-slate-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
            aria-expanded={showSignatureManager}
          >
            <PenLine className="h-4 w-4" />
            Saini na Muhuri
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {data && !loadingReport ? `${cards.length} report card(s)` : ""}
          </span>
        </div>
      </div>

      {data && showSignatureManager ? (
        <SignatureManager
          school={data.school}
          onSchoolChange={updateSchoolSignatures}
          onClose={() => setShowSignatureManager(false)}
        />
      ) : null}

      {loadingExams || loadingReport ? (
        <LoadingIndicator label="Loading report cards..." className="py-12" />
      ) : error ? (
        <div
          role="alert"
          className="rounded border border-slate-400 bg-slate-50 p-3 text-sm font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {error}
        </div>
      ) : data && cards.length === 0 ? (
        <div className="rounded border border-slate-300 bg-white p-8 text-center text-sm dark:border-slate-700 dark:bg-slate-900">
          No students sat this examination.
        </div>
      ) : data ? (
        cards.map((student) => (
          <ReportCard
            key={student.id}
            exam={data.exam}
            exams={data.exams}
            school={data.school}
            student={student}
            result={selectedExamResults[student.id]}
            results={data.results}
            subjects={data.subjects}
            previousCount={previousCount}
            reportDate={reportDate}
            totalStudents={totalStudents}
          />
        ))
      ) : null}
    </div>
  );
}

function ReportCard({
  exam,
  exams,
  school,
  student,
  result,
  results,
  subjects,
  previousCount,
  reportDate,
  totalStudents,
}: {
  exam: Exam;
  exams: Exam[];
  school: School;
  student: Student;
  result: StoredResult;
  results: Record<string, Record<string, StoredResult>>;
  subjects: SubjectMeta[];
  previousCount: number;
  reportDate: string;
  totalStudents: number;
}) {
  const subjectRows = subjectsFor(result, subjects);
  const historyRows = historyFor(exam, exams, results, student.id, previousCount);
  const district = school.district || school.region || "—";
  const displayForm = student.form || exam.class_form;
  const displayStream = student.stream || "—";
  const comments = {
    headmaster: commentForAverage(result.average, "headmaster", student.id),
    subjectTeacher: commentForAverage(result.average, "subjectTeacher", student.id),
    classTeacher: commentForAverage(result.average, "classTeacher", student.id),
  };
  const parentParagraph = buildParentParagraph(student, exam, result, totalStudents);

  return (
    <article className="report-card mx-auto w-full bg-white p-[7mm] text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 sm:p-[8mm]">
      <header className="report-card-header text-center">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          HALMASHAURI YA WILAYA YA {district}
        </p>
        <h1 className="text-lg font-extrabold uppercase leading-tight sm:text-xl">
          {school.school_name}
        </h1>
        <p className="text-[12px] text-slate-700 dark:text-slate-300">
          {postalLine(school.address)}
        </p>
          <p className="report-card-exam-title mt-1 text-[12px] font-bold uppercase">
          RIPOTI YA MATOKEO — {exam.name} {exam.academic_year}
        </p>
      </header>

      <section className="report-student-info mt-2 border-y border-slate-300 py-1.5 text-[12px] leading-snug dark:border-slate-600">
        <p>
          <span className="font-bold">JINA:</span>{" "}
          <span className="font-semibold">{student.full_name}</span>
        </p>
        <p className="mt-0.5">
          <span className="font-bold">Darasa:</span> {displayForm} |{" "}
          <span className="font-bold">Mkondo:</span> {displayStream} |{" "}
          <span className="font-bold">Jinsia:</span> {student.sex}
        </p>
      </section>

      <section className="mt-2">
        <table className="w-full table-fixed border-collapse text-left text-[12px] leading-tight">
          <colgroup>
            <col className="w-[44%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead className="bg-[#1f3a5f] text-white dark:bg-slate-700">
            <tr>
              {["MASOMO", "ALAMA", "DARAJA", "POINTI", "MAONI"].map((label) => (
                <th
                  key={label}
                  className="border border-slate-300 px-1.5 py-1 font-bold uppercase dark:border-slate-600"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjectRows.map((subject) => (
              <tr
                key={subject.id}
                className="border-t border-slate-300 odd:bg-white even:bg-slate-50 dark:border-slate-600 dark:odd:bg-slate-900 dark:even:bg-slate-800/60"
              >
                <td className="border border-slate-300 px-1.5 py-0.5 font-medium dark:border-slate-600">
                  {subject.name}
                </td>
                <td className="border border-slate-300 px-1.5 py-0.5 text-center dark:border-slate-600">
                  {formatScore(subject.mark)}%
                </td>
                <td className="border border-slate-300 p-0 text-center dark:border-slate-600">
                  <span
                    className={`block px-1 py-0.5 font-bold ${GRADE_CELL_CLASS[subject.grade]}`}
                  >
                    {subject.grade}
                  </span>
                </td>
                <td className="border border-slate-300 px-1.5 py-0.5 text-center dark:border-slate-600">
                  {subject.points}
                </td>
                <td className="border border-slate-300 px-1.5 py-0.5 dark:border-slate-600">
                  {subject.remark}
                </td>
              </tr>
            ))}
            {subjectRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="border border-slate-300 px-1.5 py-2 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400"
                >
                  Hakuna masomo yaliyofanywa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-2">
        <h2 className="report-card-section-title border-b border-slate-300 pb-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:text-slate-100">
          HISTORIA YA MITIHANI — {exam.class_form.toUpperCase()}
        </h2>
        <table className="mt-1 w-full table-fixed border-collapse text-left text-[12px] leading-tight">
          <colgroup>
            <col className="w-[27%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[27%]" />
          </colgroup>
          <thead className="bg-[#1f3a5f] text-white dark:bg-slate-700">
            <tr>
              {["MTIHANI", "TAREHE", "WASTANI", "NAFASI", "DARAJA", "POINTI", "MWENENDO"].map(
                (label) => (
                  <th
                    key={label}
                    className="border border-slate-300 px-1 py-1 font-bold uppercase dark:border-slate-600"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {historyRows.map((row) => (
              <tr
                key={row.exam.id}
                className="border-t border-slate-300 odd:bg-white even:bg-slate-50 dark:border-slate-600 dark:odd:bg-slate-900 dark:even:bg-slate-800/60"
              >
                <td className="border border-slate-300 px-1 py-0.5 dark:border-slate-600">
                  <span className="font-semibold">{row.exam.name}</span>
                  <span className="ml-1 text-slate-500 dark:text-slate-400">
                    · {formatShortMonthYear(row.exam.start_date)}
                  </span>
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center dark:border-slate-600">
                  {row.date}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center dark:border-slate-600">
                  {formatAverage(row.average)}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center dark:border-slate-600">
                  {row.position ?? "—"}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center font-bold dark:border-slate-600">
                  {row.grade ?? "—"}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 text-center dark:border-slate-600">
                  {row.points ?? "—"}
                </td>
                <td className="border border-slate-300 px-1 py-0.5 dark:border-slate-600">
                  <span className={TREND_DISPLAY[row.trend].className}>
                    {TREND_DISPLAY[row.trend].text}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-2">
        <h2 className="report-card-section-title border-b border-slate-300 pb-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:text-slate-100">
          TABIA NA MWENENDO
        </h2>
        <table className="mt-1 w-full table-fixed border-collapse text-left text-[12px] leading-tight">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[36%]" />
            <col className="w-[10%]" />
            <col className="w-[4%]" />
            <col className="w-[36%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-[#1f3a5f] text-white dark:bg-slate-700">
            <tr>
              {["NA.", "MAELEZO", "ALAMA", "NA.", "MAELEZO", "ALAMA"].map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className="border border-slate-300 px-1 py-1 font-bold uppercase dark:border-slate-600"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((index) => {
              const rightIndex = index + 4;
              return (
                <tr
                  key={index}
                  className="border-t border-slate-300 odd:bg-white even:bg-slate-50 dark:border-slate-600 dark:odd:bg-slate-900 dark:even:bg-slate-800/60"
                >
                  <td className="border border-slate-300 px-1 py-0.5 text-center dark:border-slate-600">
                    {index + 1}
                  </td>
                  <td className="border border-slate-300 px-1 py-0.5 dark:border-slate-600">
                    {BEHAVIOUR_ITEMS[index]}
                  </td>
                  <td className="border border-slate-300 px-1 py-0.5 text-center tracking-widest text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    __________
                  </td>
                  <td className="border border-slate-300 px-1 py-0.5 text-center dark:border-slate-600">
                    {rightIndex + 1}
                  </td>
                  <td className="border border-slate-300 px-1 py-0.5 dark:border-slate-600">
                    {BEHAVIOUR_ITEMS[rightIndex]}
                  </td>
                  <td className="border border-slate-300 px-1 py-0.5 text-center tracking-widest text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    __________
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-2">
        <h2 className="report-card-section-title border-b border-slate-300 pb-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:text-slate-100">
          MAONI YA UONGOZI NA WALIMU
        </h2>
        <div className="report-card-comments mt-1 space-y-0.5 text-[12px] leading-snug">
          <p>
            <span className="font-bold">Mkuu wa Shule:</span> {comments.headmaster}
          </p>
          <p>
            <span className="font-bold">Mwalimu wa Taaluma:</span> {comments.subjectTeacher}
          </p>
          <p>
            <span className="font-bold">Mwalimu wa Darasa:</span> {comments.classTeacher}
          </p>
        </div>
      </section>

      <p className="report-card-parent mt-2 border border-slate-300 p-1.5 text-justify text-[12px] leading-snug dark:border-slate-600">
        {parentParagraph}
      </p>

      <ReportCardSignatures school={school} />

      <footer className="report-card-footer mt-2 border-t border-slate-300 pt-1 text-center text-[12px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
        Ripoti hii imetolewa na Ofisi ya Taaluma | Tarehe: {reportDate || "—"}
      </footer>
    </article>
  );
}
