"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Search,
  Square,
  SquareCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type FormLevel = "Form I" | "Form II" | "Form III" | "Form IV";
type Sex = "M" | "F";

type SchoolClass = {
  id: string;
  form: FormLevel;
  stream: string;
};

type Student = {
  id: string;
  class_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  sex: Sex;
  admission_no: string | null;
  created_at: string;
};

type OptionalSubject = {
  id: string;
  name: string;
  subject_code: string;
};

type EditForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  sex: Sex;
  admission_no: string;
};

const FORMS: FormLevel[] = ["Form I", "Form II", "Form III", "Form IV"];
const EMPTY_EDIT_FORM: EditForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "M",
  admission_no: "",
};

function classLabel(schoolClass: SchoolClass) {
  return `${schoolClass.form} ${schoolClass.stream}`;
}

export function RegisteredStudentsManager({
  registrationHref,
}: {
  registrationHref: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormLevel | "All">("All");
  const [selectedClassId, setSelectedClassId] = useState("All");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(),
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentToPromote, setStudentToPromote] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState("");
  const [studentForSubjects, setStudentForSubjects] = useState<Student | null>(
    null,
  );
  const [optionalSubjects, setOptionalSubjects] = useState<OptionalSubject[]>([]);
  const [enrolledSubjectIds, setEnrolledSubjectIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [updatingSubjectId, setUpdatingSubjectId] = useState<string | null>(
    null,
  );
  const [bulkDialog, setBulkDialog] = useState<
    "subjects" | "promote" | "delete" | null
  >(null);
  const [bulkSubjects, setBulkSubjects] = useState<OptionalSubject[]>([]);
  const [bulkSubjectId, setBulkSubjectId] = useState("");

  const load = useCallback(async () => {
    const [classesResult, studentsResult] = await Promise.all([
      supabase.from("classes").select("id, form, stream").order("form").order("stream"),
      supabase
        .from("students")
        .select(
          "id, class_id, first_name, middle_name, last_name, full_name, sex, admission_no, created_at",
        )
        .order("last_name")
        .order("first_name"),
    ]);

    if (classesResult.error || studentsResult.error) {
      notify(
        "error",
        classesResult.error?.message ??
          studentsResult.error?.message ??
          "Unable to load registered students.",
      );
      setLoading(false);
      return;
    }

    setClasses((classesResult.data ?? []) as SchoolClass[]);
    setStudents((studentsResult.data ?? []) as Student[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const classesForForm = useMemo(
    () =>
      selectedForm === "All"
        ? classes
        : classes.filter((schoolClass) => schoolClass.form === selectedForm),
    [classes, selectedForm],
  );

  const visibleStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((student) => {
      const schoolClass = classes.find((item) => item.id === student.class_id);
      if (!schoolClass) return false;
      if (selectedForm !== "All" && schoolClass.form !== selectedForm) {
        return false;
      }
      if (selectedClassId !== "All" && student.class_id !== selectedClassId) {
        return false;
      }
      if (!term) return true;
      return (
        student.full_name.toLowerCase().includes(term) ||
        (student.admission_no?.toLowerCase().includes(term) ?? false) ||
        classLabel(schoolClass).toLowerCase().includes(term)
      );
    });
  }, [classes, search, selectedClassId, selectedForm, students]);

  const studentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of students) {
      counts.set(student.class_id, (counts.get(student.class_id) ?? 0) + 1);
    }
    return counts;
  }, [students]);
  const selectedStudents = useMemo(
    () => students.filter((student) => selectedStudentIds.has(student.id)),
    [selectedStudentIds, students],
  );
  const selectedForms = useMemo(
    () =>
      new Set(
        selectedStudents
          .map((student) =>
            classes.find((schoolClass) => schoolClass.id === student.class_id)
              ?.form,
          )
          .filter((form): form is FormLevel => Boolean(form)),
      ),
    [classes, selectedStudents],
  );
  const canBulkManageSameForm =
    selectedStudents.length > 0 && selectedForms.size === 1;
  const selectedFormForBulk = selectedForms.values().next().value as
    | FormLevel
    | undefined;
  const nextFormForBulk =
    selectedFormForBulk && selectedFormForBulk !== "Form IV"
      ? FORMS[FORMS.indexOf(selectedFormForBulk) + 1]
      : null;
  const bulkPromotionClasses = nextFormForBulk
    ? classes.filter((schoolClass) => schoolClass.form === nextFormForBulk)
    : [];
  const allVisibleSelected =
    visibleStudents.length > 0 &&
    visibleStudents.every((student) => selectedStudentIds.has(student.id));

  function selectForm(form: FormLevel | "All") {
    setSelectedForm(form);
    setSelectedClassId("All");
  }

  function toggleStudentSelection(studentId: string) {
    if (!selectedStudentIds.has(studentId) && selectedStudentIds.size >= 500) {
      notify("error", "You can select up to 500 students for a bulk action.");
      return;
    }
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleVisibleStudentSelection() {
    if (!allVisibleSelected) {
      const next = new Set(selectedStudentIds);
      visibleStudents.forEach((student) => next.add(student.id));
      if (next.size > 500) {
        notify("error", "Bulk actions are limited to 500 selected students.");
        return;
      }
    }
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleStudents.forEach((student) => next.delete(student.id));
      } else {
        visibleStudents.forEach((student) => next.add(student.id));
      }
      return next;
    });
  }

  async function openBulkSubjects() {
    if (!canBulkManageSameForm || selectedStudents.length === 0) {
      notify("error", "Select students from the same form to manage subjects.");
      return;
    }

    const representativeStudent = selectedStudents[0];
    try {
      const response = await fetch(
        `/api/student-subjects?classId=${encodeURIComponent(representativeStudent.class_id)}`,
      );
      const result = (await response.json()) as {
        subjects?: OptionalSubject[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Unable to load optional subjects.");
      }
      const subjects = result.subjects ?? [];
      setBulkSubjects(subjects);
      setBulkSubjectId(subjects[0]?.id ?? "");
      setBulkDialog("subjects");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to load optional subjects.",
      );
    }
  }

  async function updateSelectedOptionalSubject(action: "assign" | "unassign") {
    if (!bulkSubjectId || selectedStudents.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch("/api/student-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents.map((student) => student.id),
          subjectId: bulkSubjectId,
          action,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to update optional subjects.");
      }
      notify(
        "success",
        `Optional subject ${action === "assign" ? "assigned to" : "removed from"} ${selectedStudents.length} student(s).`,
      );
      setSelectedStudentIds(new Set());
      setBulkDialog(null);
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to update optional subjects.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function promoteSelectedStudents() {
    if (!canBulkManageSameForm || !targetClassId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/students/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents.map((student) => student.id),
          targetClassId,
          action: "promote",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to promote selected students.");
      }
      const destination = classes.find((item) => item.id === targetClassId);
      notify(
        "success",
        `${selectedStudents.length} student(s) promoted to ${destination ? classLabel(destination) : "the next form"}.`,
      );
      setSelectedStudentIds(new Set());
      setBulkDialog(null);
      await load();
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to promote selected students.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedStudents() {
    if (selectedStudents.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .in(
          "id",
          selectedStudents.map((student) => student.id),
        );
      if (error) throw error;
      notify("success", `${selectedStudents.length} student(s) deleted.`);
      setSelectedStudentIds(new Set());
      setBulkDialog(null);
      await load();
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to delete students.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openEdit(student: Student) {
    setStudentToEdit(student);
    setEditForm({
      first_name: student.first_name,
      middle_name: student.middle_name ?? "",
      last_name: student.last_name,
      sex: student.sex,
      admission_no: student.admission_no ?? "",
    });
  }

  async function saveStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentToEdit) return;

    const firstName = editForm.first_name.trim();
    const lastName = editForm.last_name.trim();
    if (!firstName || !lastName) {
      notify("error", "First and last name are required.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          first_name: firstName,
          middle_name: editForm.middle_name.trim() || null,
          last_name: lastName,
          sex: editForm.sex,
          admission_no: editForm.admission_no.trim() || null,
        })
        .eq("id", studentToEdit.id);

      if (error) throw error;
      notify("success", "Student details updated.");
      setStudentToEdit(null);
      await load();
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to update student.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent() {
    if (!studentToDelete) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentToDelete.id);

      if (error) throw error;
      notify("success", `${studentToDelete.full_name} was deleted.`);
      setStudentToDelete(null);
      await load();
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to delete student.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openPromote(student: Student) {
    const currentClass = classes.find((item) => item.id === student.class_id);
    if (!currentClass) {
      notify("error", "The student's current class could not be found.");
      return;
    }
    if (currentClass.form === "Form IV") {
      notify("error", "Form IV students cannot be promoted to another form.");
      return;
    }

    const nextForm = FORMS[FORMS.indexOf(currentClass.form) + 1];
    const nextClasses = classes.filter((item) => item.form === nextForm);
    if (nextClasses.length === 0) {
      notify("error", `Create a ${nextForm} stream before promoting students.`);
      return;
    }

    setStudentToPromote(student);
    setTargetClassId(nextClasses[0].id);
  }

  async function promoteStudent() {
    if (!studentToPromote || !targetClassId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/students/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentToPromote.id,
          targetClassId,
          action: "promote",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to promote student.");
      }

      const destination = classes.find((item) => item.id === targetClassId);
      notify(
        "success",
        `${studentToPromote.full_name} promoted to ${destination ? classLabel(destination) : "the next class"}.`,
      );
      setStudentToPromote(null);
      await load();
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to promote student.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function openOptionalSubjects(student: Student) {
    setStudentForSubjects(student);
    setOptionalSubjects([]);
    setEnrolledSubjectIds(new Set());
    setLoadingSubjects(true);

    try {
      const subjectsResponse = await fetch(
        `/api/student-subjects?classId=${encodeURIComponent(student.class_id)}`,
      );
      const subjectsResult = await subjectsResponse.json();

      if (!subjectsResponse.ok) {
        throw new Error(subjectsResult.error || "Unable to load optional subjects.");
      }

      const subjects = (subjectsResult.subjects ?? []) as OptionalSubject[];
      const statusResults = await Promise.all(
        subjects.map(async (subject) => {
          const response = await fetch(
            `/api/student-subjects/status?classId=${encodeURIComponent(student.class_id)}&subjectId=${encodeURIComponent(subject.id)}`,
          );
          const result = (await response.json()) as {
            enrolledStudentIds?: string[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(result.error || "Unable to load student enrollments.");
          }
          return {
            subjectId: subject.id,
            isEnrolled: (result.enrolledStudentIds ?? []).includes(student.id),
          };
        }),
      );

      setOptionalSubjects(subjects);
      setEnrolledSubjectIds(
        new Set(
          statusResults
            .filter((result) => result.isEnrolled)
            .map((result) => result.subjectId),
        ),
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to load optional subjects.",
      );
      setStudentForSubjects(null);
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function toggleOptionalSubject(subject: OptionalSubject) {
    if (!studentForSubjects) return;
    const isEnrolled = enrolledSubjectIds.has(subject.id);
    setUpdatingSubjectId(subject.id);

    try {
      const response = await fetch("/api/student-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [studentForSubjects.id],
          subjectId: subject.id,
          action: isEnrolled ? "unassign" : "assign",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to update optional subject.");
      }

      setEnrolledSubjectIds((current) => {
        const next = new Set(current);
        if (isEnrolled) next.delete(subject.id);
        else next.add(subject.id);
        return next;
      });
      notify(
        "success",
        isEnrolled ? "Optional subject removed." : "Optional subject assigned.",
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to update optional subject.",
      );
    } finally {
      setUpdatingSubjectId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-800 p-5 text-white shadow-lg sm:p-7">
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
              <Users className="h-3.5 w-3.5" />
              Student records
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Registered Students
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/90 sm:text-base">
              Find students, manage optional subjects, update personal details,
              and move students to the next form.
            </p>
          </div>
          <Link
            href={registrationHref}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 transition hover:bg-blue-50 sm:w-auto"
          >
            <GraduationCap className="h-4 w-4" />
            Student registration
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm text-slate-500">Total registered</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {loading ? "—" : students.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm text-slate-500">Classes</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {loading ? "—" : classes.length}
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-1 sm:p-5">
          <p className="text-sm text-slate-500">Showing</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {loading ? "—" : visibleStudents.length}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {(["All", ...FORMS] as const).map((form) => {
              const count =
                form === "All"
                  ? students.length
                  : students.filter(
                      (student) =>
                        classes.find((item) => item.id === student.class_id)
                          ?.form === form,
                    ).length;
              const active = selectedForm === form;
              return (
                <button
                  key={form}
                  type="button"
                  onClick={() => selectForm(form)}
                  className={`min-h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                    active
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  }`}
                >
                  {form}
                  <span className={`ml-2 text-xs ${active ? "text-blue-100" : "text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)]">
            <label className="relative block">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, admission number, or class"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="All">All classes</option>
              {classesForForm.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {classLabel(schoolClass)} ({studentCounts.get(schoolClass.id) ?? 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && visibleStudents.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleVisibleStudentSelection}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {allVisibleSelected ? (
                  <SquareCheck className="h-4 w-4 text-blue-700" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allVisibleSelected ? "Deselect visible" : "Select visible"}
              </button>
              <span className="text-sm font-medium text-slate-600">
                {selectedStudentIds.size} selected
                {canBulkManageSameForm &&
                  selectedFormForBulk &&
                  ` · ${selectedFormForBulk}`}
                {selectedStudentIds.size > 0 && !canBulkManageSameForm &&
                  " · Choose one form for subject assignment and promotion"}
              </span>
            </div>
            {selectedStudentIds.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openBulkSubjects()}
                  disabled={!canBulkManageSameForm || saving}
                  title={
                    canBulkManageSameForm
                      ? "Assign or remove an optional subject"
                      : "Selected students must belong to the same form"
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <BookOpen className="h-4 w-4" />
                  Bulk optional subjects
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canBulkManageSameForm) return;
                    if (bulkPromotionClasses.length === 0) {
                      notify(
                        "error",
                        selectedFormForBulk === "Form IV"
                          ? "Form IV students cannot be promoted to another form."
                          : `Create a ${nextFormForBulk} stream before promoting students.`,
                      );
                      return;
                    }
                    setTargetClassId(bulkPromotionClasses[0].id);
                    setBulkDialog("promote");
                  }}
                  disabled={
                    !canBulkManageSameForm ||
                    selectedFormForBulk === "Form IV" ||
                    saving
                  }
                  title={
                    selectedFormForBulk === "Form IV"
                      ? "Form IV students cannot be promoted"
                      : "Promote selected students to the next form"
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <GraduationCap className="h-4 w-4" />
                  Bulk upgrade
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDialog("delete")}
                  disabled={saving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Bulk delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds(new Set())}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center px-5 py-12">
            <LoadingIndicator label="Loading registered students..." />
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <GraduationCap className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">
              {students.length === 0 ? "No students registered yet" : "No students found"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {students.length === 0
                ? "Register students first. They will appear here for ongoing management."
                : "Try a different search or class filter."}
            </p>
            {students.length === 0 && (
              <Link
                href={registrationHref}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Go to student registration
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleStudentSelection}
                        aria-label="Select all visible students"
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-5 py-3 font-semibold">Admission no.</th>
                    <th className="px-5 py-3 font-semibold">Class</th>
                    <th className="px-5 py-3 font-semibold">Gender</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleStudents.map((student) => (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/70 ${selectedStudentIds.has(student.id) ? "bg-blue-50/60" : ""}`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          aria-label={`Select ${student.full_name}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {student.full_name}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {student.admission_no || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {classes.find((item) => item.id === student.class_id)
                            ? classLabel(
                                classes.find((item) => item.id === student.class_id)!,
                              )
                            : "Class unavailable"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {student.sex === "M" ? "Male" : "Female"}
                      </td>
                      <td className="px-5 py-4">
                        <StudentActions
                          student={student}
                          onEdit={() => openEdit(student)}
                          onSubjects={() => void openOptionalSubjects(student)}
                          onPromote={() => openPromote(student)}
                          onDelete={() => setStudentToDelete(student)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {visibleStudents.map((student) => {
                const schoolClass = classes.find(
                  (item) => item.id === student.class_id,
                );
                return (
                  <article
                    key={student.id}
                    className={`space-y-3 p-4 ${selectedStudentIds.has(student.id) ? "bg-blue-50/60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        aria-label={`Select ${student.full_name}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                      />
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-slate-900">
                          {student.full_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {student.admission_no || "No admission number"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {schoolClass ? classLabel(schoolClass) : "Class unavailable"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        {student.sex === "M" ? "Male" : "Female"}
                      </span>
                      <StudentActions
                        student={student}
                        onEdit={() => openEdit(student)}
                        onSubjects={() => void openOptionalSubjects(student)}
                        onPromote={() => openPromote(student)}
                        onDelete={() => setStudentToDelete(student)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {studentToEdit && (
        <Modal title="Edit student details" onClose={() => setStudentToEdit(null)}>
          <form onSubmit={(event) => void saveStudent(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="First name"
                value={editForm.first_name}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, first_name: value }))
                }
                required
              />
              <TextField
                label="Middle name"
                value={editForm.middle_name}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, middle_name: value }))
                }
              />
              <TextField
                label="Last name"
                value={editForm.last_name}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, last_name: value }))
                }
                required
              />
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Gender
                <select
                  value={editForm.sex}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      sex: event.target.value as Sex,
                    }))
                  }
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <TextField
                  label="Admission number"
                  value={editForm.admission_no}
                  onChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      admission_no: value,
                    }))
                  }
                />
              </div>
            </div>
            <ModalActions
              onCancel={() => setStudentToEdit(null)}
              busy={saving}
              submitLabel="Save changes"
            />
          </form>
        </Modal>
      )}

      {studentForSubjects && (
        <Modal
          title="Optional subject enrollment"
          description={`${studentForSubjects.full_name} · ${classes.find((item) => item.id === studentForSubjects.class_id) ? classLabel(classes.find((item) => item.id === studentForSubjects.class_id)!) : ""}`}
          onClose={() => setStudentForSubjects(null)}
        >
          {loadingSubjects ? (
            <LoadingIndicator label="Loading optional subjects..." className="py-6" />
          ) : optionalSubjects.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              No optional subjects are configured for this form. Set them up in
              the subject assignments page first.
            </p>
          ) : (
            <div className="space-y-2">
              {optionalSubjects.map((subject) => {
                const enrolled = enrolledSubjectIds.has(subject.id);
                const busy = updatingSubjectId === subject.id;
                return (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{subject.name}</p>
                      <p className="text-xs text-slate-500">{subject.subject_code}</p>
                    </div>
                    <button
                      type="button"
                      disabled={updatingSubjectId !== null}
                      onClick={() => void toggleOptionalSubject(subject)}
                      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${
                        enrolled
                          ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-blue-700 text-white hover:bg-blue-800"
                      }`}
                    >
                      {busy ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : enrolled ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                      {enrolled ? "Assigned" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {studentToPromote && (
        <Modal
          title="Promote student"
          description={`Move ${studentToPromote.full_name} to the next form.`}
          onClose={() => setStudentToPromote(null)}
        >
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Destination class
              <select
                value={targetClassId}
                onChange={(event) => setTargetClassId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                {classes
                  .filter((schoolClass) => {
                    const currentClass = classes.find(
                      (item) => item.id === studentToPromote.class_id,
                    );
                    return (
                      currentClass &&
                      FORMS.indexOf(schoolClass.form) ===
                        FORMS.indexOf(currentClass.form) + 1
                    );
                  })
                  .map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {classLabel(schoolClass)}
                    </option>
                  ))}
              </select>
            </label>
            <p className="text-xs leading-5 text-slate-500">
              Compulsory subjects will be updated for the destination form.
            </p>
            <ModalActions
              onCancel={() => setStudentToPromote(null)}
              onConfirm={() => void promoteStudent()}
              busy={saving}
              submitLabel="Promote student"
            />
          </div>
        </Modal>
      )}

      {studentToDelete && (
        <Modal
          title="Delete student"
          description={`Are you sure you want to delete ${studentToDelete.full_name}? This will also remove their subject enrollments. This action cannot be undone.`}
          onClose={() => setStudentToDelete(null)}
        >
          <ModalActions
            onCancel={() => setStudentToDelete(null)}
            onConfirm={() => void deleteStudent()}
            busy={saving}
            submitLabel="Delete student"
            destructive
          />
        </Modal>
      )}

      {bulkDialog === "subjects" && (
        <Modal
          title="Bulk optional subject assignment"
          description={`Apply an optional subject to ${selectedStudents.length} selected student(s) in ${selectedFormForBulk ?? "the selected form"}.`}
          onClose={() => setBulkDialog(null)}
        >
          {bulkSubjects.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              No optional subjects are configured for this form. Configure
              optional subjects in the class subject assignments page first.
            </p>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Optional subject
                <select
                  value={bulkSubjectId}
                  onChange={(event) => setBulkSubjectId(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  {bulkSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.subject_code})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setBulkDialog(null)}
                  disabled={saving}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void updateSelectedOptionalSubject("unassign")}
                  disabled={saving || !bulkSubjectId}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove from selected
                </button>
                <button
                  type="button"
                  onClick={() => void updateSelectedOptionalSubject("assign")}
                  disabled={saving || !bulkSubjectId}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Assign to selected
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {bulkDialog === "promote" && (
        <Modal
          title="Bulk upgrade students"
          description={`Promote ${selectedStudents.length} student(s) from ${selectedFormForBulk ?? "the selected form"} to ${nextFormForBulk ?? "the next form"}.`}
          onClose={() => setBulkDialog(null)}
        >
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Destination class
              <select
                value={targetClassId}
                onChange={(event) => setTargetClassId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                {bulkPromotionClasses.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {classLabel(schoolClass)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs leading-5 text-slate-500">
              All selected students will move to this class. Compulsory
              subjects will update automatically, and optional subjects not
              offered in the next form will be removed.
            </p>
            <ModalActions
              onCancel={() => setBulkDialog(null)}
              onConfirm={() => void promoteSelectedStudents()}
              busy={saving}
              submitLabel={`Upgrade ${selectedStudents.length} student(s)`}
            />
          </div>
        </Modal>
      )}

      {bulkDialog === "delete" && (
        <Modal
          title="Delete selected students"
          description={`You are about to permanently delete ${selectedStudents.length} student(s) and their subject enrollments. This action cannot be undone.`}
          onClose={() => setBulkDialog(null)}
        >
          <ModalActions
            onCancel={() => setBulkDialog(null)}
            onConfirm={() => void deleteSelectedStudents()}
            busy={saving}
            submitLabel={`Delete ${selectedStudents.length} student(s)`}
            destructive
          />
        </Modal>
      )}
    </div>
  );
}

function StudentActions({
  student,
  onEdit,
  onSubjects,
  onPromote,
  onDelete,
}: {
  student: Student;
  onEdit: () => void;
  onSubjects: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <ActionButton label={`Edit ${student.full_name}`} onClick={onEdit}>
        <Pencil className="h-4 w-4" />
        <span className="hidden lg:inline">Edit</span>
      </ActionButton>
      <ActionButton
        label={`Manage optional subjects for ${student.full_name}`}
        onClick={onSubjects}
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden lg:inline">Subjects</span>
      </ActionButton>
      <ActionButton
        label={`Promote ${student.full_name}`}
        onClick={onPromote}
      >
        <ArrowRight className="h-4 w-4" />
        <span className="hidden lg:inline">Promote</span>
      </ActionButton>
      <ActionButton
        label={`Delete ${student.full_name}`}
        onClick={onDelete}
        destructive
      >
        <Trash2 className="h-4 w-4" />
        <span className="hidden lg:inline">Delete</span>
      </ActionButton>
    </div>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        destructive
          ? "border-rose-200 text-rose-700 hover:bg-rose-50"
          : "border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      {label}
      <input
        value={value}
        required={required}
        maxLength={100}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      />
    </label>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-management-modal-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="student-management-modal-title"
              className="text-lg font-bold text-slate-950"
            >
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  busy,
  submitLabel,
  destructive = false,
}: {
  onCancel: () => void;
  onConfirm?: () => void;
  busy: boolean;
  submitLabel: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type={onConfirm ? "button" : "submit"}
        onClick={onConfirm}
        disabled={busy}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${
          destructive
            ? "bg-rose-600 hover:bg-rose-700"
            : "bg-blue-700 hover:bg-blue-800"
        }`}
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
