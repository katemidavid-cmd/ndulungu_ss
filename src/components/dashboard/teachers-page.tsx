"use client";

import { useEffect, useState } from "react";
import { Edit, Plus, Trash2, X } from "lucide-react";

interface Teacher {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  email: string | null;
  sex: string;
  phone: string | null;
}

interface Assignment {
  id: string;
  teacher_id: string;
  class_name: string;
  subject_name: string;
}

interface Subject {
  id: string;
  form: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
}

interface TeachersPageProps {
  canManageTeachers: boolean;
}

const inputClassName =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50";

export default function TeachersPage({ canManageTeachers }: TeachersPageProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmTeacher, setConfirmTeacher] = useState<Teacher | null>(null);
  const [confirmAssignment, setConfirmAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    password: "",
    sex: "M",
    phone: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    class_name: "",
    subject_name: "",
  });

  const fetchAll = async () => {
    try {
      const responses = await Promise.all([
        fetch("/api/teachers"),
        fetch("/api/teachers/assignments"),
        fetch("/api/class-subjects"),
      ]);
      const data = await Promise.all(
        responses.map(async (response) => {
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error || "Unable to load teacher information.");
          }
          return body;
        }),
      );

      setTeachers(data[0].teachers || []);
      setAssignments(data[1].assignments || []);
      setClassSubjects(data[2].assignments || []);
      setError("");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load teacher information.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchAll);
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
  };

  const openAddTeacher = () => {
    setError("");
    setEditing(null);
    setForm({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      password: "",
      sex: "M",
      phone: "",
    });
    setShowTeacherModal(true);
  };

  const openEditTeacher = (teacher: Teacher) => {
    setError("");
    setEditing(teacher);
    setForm({
      first_name: teacher.first_name,
      middle_name: teacher.middle_name || "",
      last_name: teacher.last_name,
      email: teacher.email || "",
      password: "",
      sex: teacher.sex,
      phone: teacher.phone || "",
    });
    setShowTeacherModal(true);
  };

  const openAssignmentModal = (teacher: Teacher) => {
    setError("");
    setAssigningTeacher(teacher);
    setAssignmentForm({ class_name: "", subject_name: "" });
    setShowAssignmentModal(true);
  };

  const saveTeacher = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showToast("error", "First name and last name are required.");
      return;
    }
    if (!editing && (!form.email.trim() || !form.password)) {
      showToast("error", "Email and password are required to add a teacher.");
      return;
    }

    try {
      const response = await fetch(
        editing ? `/api/teachers/${editing.id}` : "/api/teachers",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            middle_name: form.middle_name || null,
            email: form.email || null,
            phone: form.phone || null,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save the teacher.");
      }

      setShowTeacherModal(false);
      showToast("success", editing ? "Teacher updated successfully." : "Teacher added successfully.");
      await fetchAll();
    } catch (saveError) {
      showToast(
        "error",
        saveError instanceof Error ? saveError.message : "Unable to save the teacher.",
      );
    }
  };

  const deleteTeacher = async (teacher: Teacher) => {
    setConfirmTeacher(teacher);
  };

  const confirmTeacherDelete = async () => {
    if (!confirmTeacher) return;

    try {
      const response = await fetch(`/api/teachers/${confirmTeacher.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to delete the teacher.");
      }
      showToast("success", `${confirmTeacher.full_name} was deleted successfully.`);
      setConfirmTeacher(null);
      await fetchAll();
    } catch (deleteError) {
      showToast(
        "error",
        deleteError instanceof Error ? deleteError.message : "Unable to delete the teacher.",
      );
      setConfirmTeacher(null);
    }
  };

  const saveAssignment = async () => {
    if (!assigningTeacher || !assignmentForm.class_name || !assignmentForm.subject_name) {
      showToast("error", "Select both a class and a subject.");
      return;
    }

    try {
      const response = await fetch("/api/teachers/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: assigningTeacher.id,
          class_name: assignmentForm.class_name,
          subject_name: assignmentForm.subject_name,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save the assignment.");
      }
      setShowAssignmentModal(false);
      showToast("success", "Teacher assignment saved successfully.");
      await fetchAll();
    } catch (saveError) {
      showToast(
        "error",
        saveError instanceof Error ? saveError.message : "Unable to save the assignment.",
      );
    }
  };

  const deleteAssignment = async (assignment: Assignment) => {
    setConfirmAssignment(assignment);
  };

  const confirmAssignmentDelete = async () => {
    if (!confirmAssignment) return;

    try {
      const response = await fetch(
        `/api/teachers/assignments/${confirmAssignment.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to remove the assignment.");
      }
      showToast("success", `${confirmAssignment.class_name} - ${confirmAssignment.subject_name} was removed.`);
      setConfirmAssignment(null);
      await fetchAll();
    } catch (deleteError) {
      showToast(
        "error",
        deleteError instanceof Error ? deleteError.message : "Unable to remove the assignment.",
      );
      setConfirmAssignment(null);
    }
  };

  const getAssignments = (teacherId: string) =>
    assignments.filter((assignment) => assignment.teacher_id === teacherId);
  const subjectsForSelectedForm = classSubjects.filter(
    (assignment) => assignment.form === assignmentForm.class_name,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Teachers</h2>
          <p className="mt-1 text-sm text-gray-600">
            {canManageTeachers
              ? "Manage teacher accounts and class assignments."
              : "View teachers and manage their class assignments."}
          </p>
        </div>
        {canManageTeachers && (
          <button
            type="button"
            onClick={openAddTeacher}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Teacher
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="rounded p-0.5 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div
            className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
              toast.type === "success" ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {toast.type === "success" ? "Success" : "Error"}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
          Loading teachers...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-0">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Teacher
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Gender
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Phone
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Classes
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Subjects
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="align-top hover:bg-gray-50/70">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {teacher.full_name}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {teacher.sex === "M" ? "Male" : "Female"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {teacher.email || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {teacher.phone || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-sm flex-wrap gap-2">
                        {getAssignments(teacher.id).length === 0 ? (
                          <span className="text-sm text-gray-500">No assignments</span>
                        ) : (
                          getAssignments(teacher.id).map((assignment) => (
                            <span
                              key={assignment.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-blue-800"
                            >
                              {assignment.class_name}
                              <button
                                type="button"
                                onClick={() => void deleteAssignment(assignment)}
                                aria-label={`Remove ${assignment.class_name} ${assignment.subject_name} assignment`}
                                title="Remove assignment"
                                className="rounded-full p-0.5 text-blue-700 hover:bg-blue-100 hover:text-red-700"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-sm flex-wrap gap-2">
                        {getAssignments(teacher.id).map((assignment) => (
                          <span
                            key={assignment.id}
                            className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-800"
                          >
                            {assignment.subject_name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openAssignmentModal(teacher)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800 transition-colors hover:bg-green-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Assign
                        </button>
                        {canManageTeachers && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditTeacher(teacher)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteTeacher(teacher)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {teachers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-gray-500"
                    >
                      No teachers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Confirm deletion</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete {confirmTeacher.full_name}?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmTeacher(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmTeacherDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Remove assignment</h3>
            <p className="mt-2 text-sm text-gray-600">
              Remove {confirmAssignment.class_name} - {confirmAssignment.subject_name} from this teacher?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAssignment(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAssignmentDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? "Edit Teacher" : "Add Teacher"}
              </h3>
              <button
                type="button"
                onClick={() => setShowTeacherModal(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First name *
                </label>
                <input
                  required
                  value={form.first_name}
                  onChange={(event) =>
                    setForm({ ...form, first_name: event.target.value })
                  }
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Middle name
                </label>
                <input
                  value={form.middle_name}
                  onChange={(event) =>
                    setForm({ ...form, middle_name: event.target.value })
                  }
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Last name *
                </label>
                <input
                  required
                  value={form.last_name}
                  onChange={(event) =>
                    setForm({ ...form, last_name: event.target.value })
                  }
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Gender *
                </label>
                <select
                  value={form.sex}
                  onChange={(event) => setForm({ ...form, sex: event.target.value })}
                  className={inputClassName}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email {!editing && "*"}
                </label>
                <input
                  type="email"
                  required={!editing}
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className={inputClassName}
                />
              </div>
              {!editing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                    className={inputClassName}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowTeacherModal(false)}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveTeacher()}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Save Teacher
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Class and Subject
                </h3>
                <p className="mt-0.5 text-sm text-gray-600">
                  Teacher: {assigningTeacher?.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignmentModal(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Class *
                </label>
                <select
                  value={assignmentForm.class_name}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      class_name: event.target.value,
                      subject_name: "",
                    })
                  }
                  className={inputClassName}
                >
                  <option value="">Select a class</option>
                  {["Form I", "Form II", "Form III", "Form IV"].map((form) => (
                    <option key={form} value={form}>
                      {form}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Subject *
                </label>
                <select
                  value={assignmentForm.subject_name}
                  disabled={!assignmentForm.class_name || subjectsForSelectedForm.length === 0}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      subject_name: event.target.value,
                    })
                  }
                  className={inputClassName}
                >
                  <option value="">
                    {!assignmentForm.class_name
                      ? "Select a class first"
                      : subjectsForSelectedForm.length
                        ? "Select a subject"
                        : "No subjects assigned to this class"}
                  </option>
                  {subjectsForSelectedForm.map((subject) => (
                    <option key={subject.id} value={subject.subject_name}>
                      {subject.subject_name} ({subject.subject_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowAssignmentModal(false)}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveAssignment()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <Plus className="h-4 w-4" />
                Add Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
