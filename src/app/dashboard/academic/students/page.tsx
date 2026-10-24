"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileUp, GraduationCap, Loader2, Plus, Search, Trash2, Users, X } from "lucide-react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";

type Toast = {
  id: number;
  type: "success" | "error";
  message: string;
};

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
  admission_no: string | null;
  created_at: string;
};

type StudentForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  sex: "M" | "F";
  admission_no: string;
};

type CsvRow = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  surname?: string;
  sex?: string;
  gender?: string;
  admission_no?: string;
  adm_no?: string;
  admission?: string;
};

const EMPTY_STUDENT: StudentForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "M",
  admission_no: "",
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

function getAdmission(row: CsvRow) {
  return row.admission_no?.trim() || row.adm_no?.trim() || row.admission?.trim() || "";
}

function getSex(row: CsvRow) {
  return normalizeSex(row.sex ?? row.gender);
}

function downloadTemplate() {
  const csv = "first_name,middle_name,last_name,sex,admission_no\nJohn,Paul,Mdoe,M,ADM001\nMary,,Kweka,F,ADM002\n";
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
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = toastIdRef.current++;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const load = useCallback(async () => {
    const [classesResult, studentsResult] = await Promise.all([
      supabase
        .from("classes")
        .select("id, form, stream, created_at")
        .order("form")
        .order("stream"),
      supabase
        .from("students")
        .select(
          "id, class_id, first_name, middle_name, last_name, full_name, sex, admission_no, created_at"
        )
        .order("last_name")
        .order("first_name"),
    ]);

    if (classesResult.error || studentsResult.error) {
      showToast(
        "error",
        "Failed to load data. Make sure the supabase/classes.sql migration has been applied."
      );
    } else {
      setError(null);
      setClasses((classesResult.data ?? []) as SchoolClass[]);
      setStudents((studentsResult.data ?? []) as Student[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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

  const studentCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const student of students) {
      map.set(student.class_id, (map.get(student.class_id) ?? 0) + 1);
    }
    return map;
  }, [students]);

  const selectedClass =
    classes.find((item) => item.id === effectiveClassId) ?? null;

  const classStudents = useMemo(
    () =>
      students
        .filter((item) => item.class_id === effectiveClassId)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [students, effectiveClassId]
  );

  const [search, setSearch] = useState("");

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return classStudents;
    return classStudents.filter((student) => {
      return (
        student.full_name.toLowerCase().includes(term) ||
        (student.admission_no?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [classStudents, search]);

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
    setError(null);
    setNotice(null);

    const { error: insertError } = await supabase.from("students").insert({
      class_id: effectiveClassId,
      first_name: firstName,
      middle_name: studentForm.middle_name.trim() || null,
      last_name: lastName,
      sex: studentForm.sex,
      admission_no: studentForm.admission_no.trim() || null,
    });

    if (insertError) {
      setSaving(false);
      showToast(
        "error",
        insertError.code === "23505"
          ? "This admission number is already used by another student."
          : insertError.message
      );
      return;
    }

    setStudentForm((current) => ({
      ...EMPTY_STUDENT,
      sex: current.sex,
    }));
    showToast("success", "Student registered successfully.");
    await load();
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
    setError(null);
    setNotice(null);

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
            admission_no: string | null;
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
              admission_no: getAdmission(row) || null,
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
            showToast(
              "error",
              insertError.code === "23505"
                ? "Some admission numbers in this CSV already exist."
                : insertError.message
            );
            return;
          }

          showToast("success", `${payload.length} student(s) imported successfully.`);
          await load();
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
    setError(null);
    setNotice(null);

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
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-gray-600 mt-1">Register and manage student names by class and stream.</p>
        </div>
        {selectedClass && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-white"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
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

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FORM_LEVELS.map((form) => {
          const active = activeForm === form;
          return (
            <button
              key={form}
              type="button"
              onClick={() => {
                setActiveForm(form);
                setError(null);
                setNotice(null);
                setSelectedClassId("");
              }}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-900 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{form}</span>
                <GraduationCap className="h-4 w-4 opacity-70" />
              </div>
              <p className={`mt-2 text-xs ${active ? "text-blue-100" : "text-gray-500"}`}>
                {formClasses.filter((item) => item.form === form).length} streams
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">Select Stream</h3>
          <p className="mt-1 text-sm text-gray-600">{activeForm}</p>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : formClasses.length ? (
            <div className="mt-4 space-y-2">
              {formClasses.map((item) => {
                const active = effectiveClassId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassId(item.id);
                      setError(null);
                      setNotice(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                      active
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {item.form} {item.stream}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {studentCountByClass.get(item.id) ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600">No streams found. Add streams under Classes first.</p>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  {selectedClass ? `${selectedClass.form} ${selectedClass.stream}` : "Select a stream"}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedClass ? `${classStudents.length} student(s)` : "Choose a stream from the left"}
                </p>
              </div>
            </div>

            {selectedClass ? (
              <>
                <form onSubmit={handleAddStudent} className="border-b border-gray-200 p-6">
                  <h4 className="text-sm font-semibold text-gray-900">Add Student Manually</h4>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label htmlFor="first_name" className="mb-1 block text-xs font-medium text-gray-600">
                        First name
                      </label>
                      <input
                        id="first_name"
                        value={studentForm.first_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, first_name: event.target.value }))
                        }
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="middle_name" className="mb-1 block text-xs font-medium text-gray-600">
                        Middle name (optional)
                      </label>
                      <input
                        id="middle_name"
                        value={studentForm.middle_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, middle_name: event.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="last_name" className="mb-1 block text-xs font-medium text-gray-600">
                        Last name
                      </label>
                      <input
                        id="last_name"
                        value={studentForm.last_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, last_name: event.target.value }))
                        }
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="sex" className="mb-1 block text-xs font-medium text-gray-600">
                        Gender
                      </label>
                      <select
                        id="sex"
                        value={studentForm.sex}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, sex: event.target.value as "M" | "F" }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="admission_no" className="mb-1 block text-xs font-medium text-gray-600">
                        Admission number (optional)
                      </label>
                      <input
                        id="admission_no"
                        value={studentForm.admission_no}
                        onChange={(event) =>
                          setStudentForm((current) => ({ ...current, admission_no: event.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add Student
                      </button>
                    </div>
                  </div>
                </form>

                <div className="overflow-x-auto">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-3">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by name or admission number"
                        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      Showing {filteredStudents.length} of {classStudents.length}
                    </p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">#</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Full name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Gender</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Admission No.</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, index) => (
                        <tr key={student.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.full_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{student.sex === "M" ? "Male" : "Female"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{student.admission_no || "-"}</td>
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
                      ))}
                      {!filteredStudents.length && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-600">
                            {classStudents.length ? "No students match your search." : "No students yet in this stream."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 shadow-lg ${
              toast.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              className="text-current/70 hover:text-current"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
