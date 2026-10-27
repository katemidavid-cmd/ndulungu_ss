"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileUp, GraduationCap, Loader2, Plus, Search, Square, SquareCheck, Trash2, Users, X } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Pagination } from "@/components/ui/pagination";
import Papa from "papaparse";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type FormLevel = "Form I" | "Form II" | "Form III" | "Form IV";

const FORM_LEVELS: FormLevel[] = ["Form I", "Form II", "Form III", "Form IV"];

type SchoolClass = {
  id: string;
  form: FormLevel;
  stream: string;
  created_at: string;
};

type Student = {
  id: string;
  class_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  sex: "M" | "F";
  created_at: string;
};

type StudentForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  sex: "M" | "F";
};

type OptionalSubject = {
  id: string;
  name: string;
  subject_code: string;
};

type CsvRow = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  surname?: string;
  sex?: string;
  gender?: string;
};

const EMPTY_STUDENT: StudentForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "M",
};

function normalizeSex(value: unknown) {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "F" || v === "FEMALE" || v === "KE") return "F" as const;
  if (v === "M" || v === "MALE" || v === "ME" || v === "BOY" || v === "BOYS") return "M" as const;
  return null;
}

function getFirstName(row: CsvRow) {
  return row.first_name?.trim() || "";
}

function getLastName(row: CsvRow) {
  return row.last_name?.trim() || row.surname?.trim() || "";
}

function getMiddleName(row: CsvRow) {
  return row.middle_name?.trim() || "";
}

function getSex(row: CsvRow) {
  return normalizeSex(row.sex ?? row.gender);
}

function downloadTemplate() {
  const csv = "first_name,middle_name,last_name,sex\nJohn,Paul,Mdoe,M\nMary,,Kweka,F\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "students_template.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeForm, setActiveForm] = useState<FormLevel>("Form I");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentForm, setStudentForm] = useState<StudentForm>(EMPTY_STUDENT);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [optionalSubjects, setOptionalSubjects] = useState<OptionalSubject[]>([]);
  const [selectedOptionalSubjectId, setSelectedOptionalSubjectId] = useState("");
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<Set<string>>(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [formCounts, setFormCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    notify(type, message);
  }, []);

  const loadClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, form, stream, created_at")
      .order("form")
      .order("stream");

    if (error) {
      showToast(
        "error",
        "Failed to load classes. Make sure the supabase/classes.sql migration has been applied."
      );
    } else {
      setClasses((data ?? []) as SchoolClass[]);
    }

    setLoading(false);
  }, [supabase, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClasses();
  }, [loadClasses]);

  const formClasses = useMemo(
    () =>
      classes
        .filter((item) => item.form === activeForm)
        .sort((a, b) => a.stream.localeCompare(b.stream)),
    [classes, activeForm]
  );

  const effectiveClassId = formClasses.some((item) => item.id === selectedClassId)
    ? selectedClassId
    : formClasses[0]?.id ?? "";

  const selectedClass =
    classes.find((item) => item.id === effectiveClassId) ?? null;

  const classTotal = classCounts[effectiveClassId] ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [effectiveClassId, debouncedSearch, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, total, pageSize]);

  const loadStudents = useCallback(async () => {
    if (!effectiveClassId) {
      setStudents([]);
      setTotal(0);
      return;
    }

    setStudentsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        classId: effectiveClassId,
        includeCounts: "1",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(`/api/students?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load students.");
      }

      setStudents((data.students ?? []) as Student[]);
      setTotal(data.total ?? 0);
      setClassCounts(
        (data.classCounts ?? {}) as Record<string, number>
      );
      setFormCounts((data.formCounts ?? {}) as Record<string, number>);
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Unable to load students."
      );
    } finally {
      setStudentsLoading(false);
    }
  }, [debouncedSearch, effectiveClassId, page, pageSize, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudents();
  }, [loadStudents, refreshKey]);

  const refreshStudents = useCallback(() => {
    setPage(1);
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => setSelectedStudentIds(new Set()));
  }, [effectiveClassId, selectedOptionalSubjectId]);

  const loadOptionalSubjects = useCallback(async () => {
    if (!effectiveClassId) {
      setOptionalSubjects([]);
      setSelectedOptionalSubjectId("");
      setEnrolledStudentIds(new Set());
      return;
    }
    try {
      const res = await fetch(`/api/student-subjects?classId=${encodeURIComponent(effectiveClassId)}`);
      const data = await res.json();
      if (res.ok) {
        const subjects = (data.subjects || []) as OptionalSubject[];
        setOptionalSubjects(subjects);
        if (!subjects.some((s) => s.id === selectedOptionalSubjectId)) {
          setSelectedOptionalSubjectId(subjects[0]?.id || "");
        }
      } else {
        setOptionalSubjects([]);
        setSelectedOptionalSubjectId("");
      }
    } catch {
      setOptionalSubjects([]);
      setSelectedOptionalSubjectId("");
    }
  }, [effectiveClassId, selectedOptionalSubjectId]);

  useEffect(() => {
    void Promise.resolve().then(loadOptionalSubjects);
  }, [loadOptionalSubjects]);

  const loadEnrollmentStatus = useCallback(async () => {
    if (!effectiveClassId || !selectedOptionalSubjectId) {
      setEnrolledStudentIds(new Set());
      return;
    }
    try {
      const res = await fetch(
        `/api/student-subjects/status?classId=${encodeURIComponent(effectiveClassId)}&subjectId=${encodeURIComponent(selectedOptionalSubjectId)}`
      );
      const data = await res.json();
      if (res.ok) {
        setEnrolledStudentIds(new Set((data.enrolledStudentIds || []) as string[]));
      } else {
        setEnrolledStudentIds(new Set());
      }
    } catch {
      setEnrolledStudentIds(new Set());
    }
  }, [effectiveClassId, selectedOptionalSubjectId]);

  useEffect(() => {
    void Promise.resolve().then(loadEnrollmentStatus);
  }, [loadEnrollmentStatus]);

  const filteredStudents = students;

  async function handleAddStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!effectiveClassId) {
      showToast("error", "Select a stream first before registering a student.");
      return;
    }

    const firstName = studentForm.first_name.trim();
    const lastName = studentForm.last_name.trim();

    if (!firstName || !lastName) {
      showToast("error", "First name and last name are required.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("students").insert({
      class_id: effectiveClassId,
      first_name: firstName,
      middle_name: studentForm.middle_name.trim() || null,
      last_name: lastName,
      sex: studentForm.sex,
    });

    if (insertError) {
      setSaving(false);
      showToast("error", insertError.message);
      return;
    }

    setStudentForm((current) => ({
      ...EMPTY_STUDENT,
      sex: current.sex,
    }));
    showToast("success", "Student registered successfully.");
    refreshStudents();
    setSaving(false);
  }

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!effectiveClassId) {
      showToast("error", "Select a stream first before importing from CSV.");
      return;
    }

    setImporting(true);
    try {
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, "_"),
        complete: async (results) => {
          const rows = results.data;
          if (!rows.length) {
            setImporting(false);
            showToast("error", "The CSV file has no rows to import.");
            return;
          }

          const payload: Array<{
            class_id: string;
            first_name: string;
            middle_name: string | null;
            last_name: string;
            sex: "M" | "F";
          }> = [];

          for (const row of rows) {
            const firstName = getFirstName(row);
            const lastName = getLastName(row);
            const sex = getSex(row);

            if (!firstName || !lastName || !sex) {
              continue;
            }

            payload.push({
              class_id: effectiveClassId,
              first_name: firstName,
              middle_name: getMiddleName(row) || null,
              last_name: lastName,
              sex,
            });
          }

          if (!payload.length) {
            setImporting(false);
            showToast(
              "error",
              "No valid rows found. Required columns: first_name/first name, last_name/surname, sex/gender (M/F)."
            );
            return;
          }

          const { error: insertError } = await supabase
            .from("students")
            .insert(payload);

          if (insertError) {
            setImporting(false);
            showToast("error", insertError.message);
            return;
          }

          showToast("success", `${payload.length} student(s) imported successfully.`);
          refreshStudents();
          setImporting(false);
        },
        error: (parseError) => {
          setImporting(false);
          showToast("error", parseError.message);
        },
      });
    } catch (e: unknown) {
      setImporting(false);
      showToast("error", e instanceof Error ? e.message : String(e));
    }
  }

  async function confirmDeleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleting(false);

    if (deleteError) {
      showToast("error", deleteError.message);
      return;
    }

    showToast("success", `${deleteTarget.full_name} was deleted.`);
    setDeleteTarget(null);
    refreshStudents();
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredStudents.map((s) => s.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.has(id));
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function handleBulkOptionalAssignment(action: "assign" | "unassign") {
    if (!selectedOptionalSubjectId || selectedStudentIds.size === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/student-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudentIds),
          subjectId: selectedOptionalSubjectId,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Failed to update optional subject assignments.");
        return;
      }
      showToast(
        "success",
        action === "assign"
          ? `${selectedStudentIds.size} student(s) assigned to optional subject.`
          : `${selectedStudentIds.size} student(s) unassigned from optional subject.`
      );
      setSelectedStudentIds(new Set());
      await loadEnrollmentStatus();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-4 text-white shadow-lg sm:p-5">
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col items-start gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
            <GraduationCap className="h-3.5 w-3.5" />
            Student administration
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Student Registration</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/90 sm:text-base">
            Register students in the correct form and stream, manually or from a CSV file.
          </p>
        </div>
        {selectedClass && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Register by CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleCsvImport(e)}
            />
          </div>
        )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FORM_LEVELS.map((form) => {
          const active = activeForm === form;
          const formStreamCount = classes.filter(
            (item) => item.form === form,
          ).length;
          const formStudentCount = formCounts[form] ?? 0;
          return (
            <button
              key={form}
              type="button"
              onClick={() => {
                setActiveForm(form);
                setSelectedClassId("");
              }}
              className={`group rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
                active
                  ? "border-blue-700 bg-blue-700 text-white shadow-blue-950/10"
                  : "border-slate-200 bg-white text-slate-900 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{form}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-white/15 text-white" : "bg-blue-50 text-blue-700"}`}>
                  <GraduationCap className="h-4 w-4" />
                </span>
              </div>
              <p className={`mt-3 text-xs ${active ? "text-blue-100" : "text-slate-500"}`}>
                {formStreamCount} streams <span className="mx-1">·</span> {formStudentCount} students
              </p>
            </button>
          );
        })}
      </section>

      <div className="space-y-5">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Step 1</p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Choose a stream</h3>
              <p className="mt-1 text-sm text-slate-500">{activeForm}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" />
            </span>
          </div>
          {loading ? (
            <LoadingIndicator label="Loading classes..." className="py-4" />
          ) : formClasses.length ? (
            <div className="mt-4 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
              {formClasses.map((item) => {
                const active = effectiveClassId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassId(item.id);
                    }}
                    className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/10"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {item.form} {item.stream}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      <Users className="h-3.5 w-3.5" />
                      {classCounts[item.id] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-800">No streams found. Add streams under Classes first.</p>
          )}
        </aside>

        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Step 2</p>
                <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-950">
                  <GraduationCap className="h-5 w-5 text-blue-700" />
                  {selectedClass ? `${selectedClass.form} ${selectedClass.stream}` : "Select a stream"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedClass ? `${classTotal} registered student(s)` : "Choose a stream to begin registration"}
                </p>
              </div>
            </div>

            {selectedClass ? (
              <>
                <form onSubmit={handleAddStudent} className="border-b border-slate-200 p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-950">Add student manually</h4>
                      <p className="mt-1 text-sm text-slate-500">Enter the student&apos;s basic details below.</p>
                    </div>
                    <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
                      Manual entry
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label htmlFor="first_name" className="mb-1.5 block text-xs font-semibold text-slate-700">
                        First name
                      </label>
                      <input
                        id="first_name"
                        value={studentForm.first_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, first_name: event.target.value }))
                        }
                        required
                        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                    <div>
                      <label htmlFor="middle_name" className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Middle name (optional)
                      </label>
                      <input
                        id="middle_name"
                        value={studentForm.middle_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, middle_name: event.target.value }))
                        }
                        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                    <div>
                      <label htmlFor="last_name" className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Last name
                      </label>
                      <input
                        id="last_name"
                        value={studentForm.last_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, last_name: event.target.value }))
                        }
                        required
                        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                    <div>
                      <label htmlFor="sex" className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Gender
                      </label>
                      <select
                        id="sex"
                        value={studentForm.sex}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, sex: event.target.value as "M" | "F" }))
                        }
                        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add Student
                      </button>
                    </div>
                  </div>
                </form>

                <div>
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search by name"
                          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                      </div>
                      <p className="text-sm text-slate-500">
                        Showing {filteredStudents.length} of {total}
                      </p>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Bulk optional subject assignment</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Select an optional subject for this form, tick students, then assign or unassign.
                        </p>
                      </div>
                      {optionalSubjects.length === 0 && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                          No optional subjects set for {selectedClass.form}
                        </span>
                      )}
                    </div>
                    {optionalSubjects.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <select
                          value={selectedOptionalSubjectId}
                          onChange={(event) => setSelectedOptionalSubjectId(event.target.value)}
                          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-auto"
                        >
                          {optionalSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name} ({subject.subject_code})
                            </option>
                          ))}
                        </select>
                        <span className="text-xs font-medium text-slate-500">
                          {selectedStudentIds.size} student(s) selected
                        </span>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleBulkOptionalAssignment("assign")}
                            disabled={bulkSaving || selectedStudentIds.size === 0}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Assign selected
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBulkOptionalAssignment("unassign")}
                            disabled={bulkSaving || selectedStudentIds.size === 0}
                            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
                          >
                            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            Unassign selected
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="hidden max-h-[60vh] overflow-auto md:block">
                  <table className="w-full min-w-[760px]">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                          <button
                            type="button"
                            onClick={toggleSelectAllVisible}
                            className="inline-flex items-center gap-2"
                            aria-label="Select all visible students"
                          >
                            {filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.id)) ? (
                              <SquareCheck className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="sr-only">Select all</span>
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">#</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Full name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Gender</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Optional status</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, index) => {
                        const isEnrolled = enrolledStudentIds.has(student.id);
                        const isSelected = selectedStudentIds.has(student.id);
                        return (
                          <tr key={student.id} className={`border-b border-gray-100 last:border-0 ${isSelected ? "bg-blue-50/40" : ""}`}>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => toggleStudentSelection(student.id)}
                                aria-label={`Select ${student.full_name}`}
                              >
                                {isSelected ? (
                                  <SquareCheck className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Square className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{(page - 1) * pageSize + index + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.full_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{student.sex === "M" ? "Male" : "Female"}</td>
                            <td className="px-4 py-3 text-sm">
                              {selectedOptionalSubjectId ? (
                                isEnrolled ? (
                                  <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">
                                    Assigned
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                                    Not assigned
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(student)}
                                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Delete ${student.full_name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredStudents.length && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-600">
                            {classTotal ? "No students match your search." : "No students yet in this stream."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>

                  <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto md:hidden">
                    {filteredStudents.map((student, index) => {
                      const isEnrolled = enrolledStudentIds.has(student.id);
                      const isSelected = selectedStudentIds.has(student.id);
                      return (
                        <article
                          key={student.id}
                          className={`space-y-3 p-4 ${isSelected ? "bg-blue-50/70" : "bg-white"}`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleStudentSelection(student.id)}
                              aria-label={`${isSelected ? "Deselect" : "Select"} ${student.full_name}`}
                              className="mt-0.5 shrink-0 rounded-md"
                            >
                              {isSelected ? (
                                <SquareCheck className="h-5 w-5 text-blue-700" />
                              ) : (
                                <Square className="h-5 w-5 text-slate-400" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="break-words text-sm font-bold text-slate-950">
                                    {student.full_name}
                                  </h4>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  {student.sex === "M" ? "Male" : "Female"}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                {selectedOptionalSubjectId ? (
                                  isEnrolled ? (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                      Optional subject assigned
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                      Not assigned
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-400">Student {(page - 1) * pageSize + index + 1}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(student)}
                                  aria-label={`Delete ${student.full_name}`}
                                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {!filteredStudents.length && (
                      <div className="px-4 py-10 text-center text-sm text-slate-500">
                        {classTotal
                          ? "No students match your search."
                          : "No students are registered in this stream yet."}
                      </div>
                    )}
                  </div>

                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    loading={studentsLoading}
                  />
                </div>
              </>
            ) : (
              <div className="p-10 text-center">
                <GraduationCap className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-600">
                  Select a stream on the left to register and view students.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Student</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.full_name}</span>?
              </p>
              <p className="mt-1 text-xs text-gray-500">This action cannot be undone.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteStudent()}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
