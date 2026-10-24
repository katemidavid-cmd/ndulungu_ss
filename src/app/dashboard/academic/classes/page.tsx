"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Loader2, Plus, Trash2, Users, X } from "lucide-react";
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
};

type Toast = {
  id: number;
  type: "success" | "error";
  message: string;
};

export default function ClassesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeForm, setActiveForm] = useState<FormLevel>("Form I");
  const [stream, setStream] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null);
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
      supabase.from("students").select("id, class_id"),
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

  const studentCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const student of students) {
      map.set(student.class_id, (map.get(student.class_id) ?? 0) + 1);
    }
    return map;
  }, [students]);

  const studentCountByForm = useMemo(() => {
    const formByClass = new Map(classes.map((item) => [item.id, item.form]));
    const map = new Map<FormLevel, number>();
    for (const student of students) {
      const form = formByClass.get(student.class_id);
      if (form) map.set(form, (map.get(form) ?? 0) + 1);
    }
    return map;
  }, [classes, students]);

  async function handleAddClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = stream.trim().toUpperCase();

    if (!name) {
      showToast("error", "Enter a stream name first (e.g. A).");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const { error: insertError } = await supabase
      .from("classes")
      .insert({ form: activeForm, stream: name });

    if (insertError) {
      setSaving(false);
      showToast(
        "error",
        insertError.code === "23505"
          ? `${activeForm} ${name} is already registered.`
          : insertError.message
      );
      return;
    }

    setStream("");
    showToast("success", `${activeForm} ${name} was added successfully.`);
    await load();
    setSaving(false);
  }

  async function confirmDeleteClass() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    setNotice(null);

    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleting(false);

    if (deleteError) {
      showToast("error", deleteError.message);
      return;
    }

    const count = studentCountByClass.get(deleteTarget.id) ?? 0;
    showToast(
      "success",
      `${deleteTarget.form} ${deleteTarget.stream} was deleted${
        count ? ` together with ${count} student(s).` : "."
      }`
    );
    setDeleteTarget(null);
    await load();
  }

  const deleteCount = deleteTarget
    ? studentCountByClass.get(deleteTarget.id) ?? 0
    : 0;

  return (
    <>
      <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Classes</h2>
        <p className="text-gray-600 mt-1">
          Manage classes from Form I to Form IV and their streams.
        </p>
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
          const streams = classes.filter((item) => item.form === form);
          const active = activeForm === form;
          return (
            <button
              key={form}
              type="button"
              onClick={() => {
                setActiveForm(form);
                setError(null);
                setNotice(null);
              }}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-900 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{form}</span>
                <BookOpen className="h-4 w-4 opacity-70" />
              </div>
              <p
                className={`mt-2 text-xs ${
                  active ? "text-blue-100" : "text-gray-500"
                }`}
              >
                {streams.length} streams &middot; {studentCountByForm.get(form) ?? 0} students
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">Add Stream</h3>
          <p className="mt-1 text-sm text-gray-600">{activeForm}</p>
          <form onSubmit={(e) => void handleAddClass(e)} className="mt-4 space-y-3">
            <div>
              <label htmlFor="stream" className="mb-1 block text-sm font-medium text-gray-700">
                Stream name
              </label>
              <input
                id="stream"
                value={stream}
                onChange={(event) => setStream(event.target.value)}
                placeholder="e.g. A"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Stream
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">{activeForm} Streams</h3>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : formClasses.length ? (
            <div className="mt-4 space-y-2">
              {formClasses.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {item.form} {item.stream}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {studentCountByClass.get(item.id) ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${item.form} ${item.stream}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600">No streams yet. Use the form above to add one.</p>
          )}
        </div>
      </div>
    </div>

    {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Stream</h3>
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
              Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.form} {deleteTarget.stream}</span>?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {deleteCount > 0
                ? `This will also delete ${deleteCount} student(s) in this stream. This action cannot be undone.`
                : "This action cannot be undone."}
            </p>
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
              onClick={() => void confirmDeleteClass()}
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

    {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Stream</h3>
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
              Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.form} {deleteTarget.stream}</span>?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {deleteCount > 0
                ? `This will also delete ${deleteCount} student(s) in this stream. This action cannot be undone.`
                : "This action cannot be undone."}
            </p>
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
              onClick={() => void confirmDeleteClass()}
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

    {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Stream</h3>
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
              Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.form} {deleteTarget.stream}</span>?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {deleteCount > 0
                ? `This will also delete ${deleteCount} student(s) in this stream. This action cannot be undone.`
                : "This action cannot be undone."}
            </p>
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
              onClick={() => void confirmDeleteClass()}
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
    </>
  );
}

