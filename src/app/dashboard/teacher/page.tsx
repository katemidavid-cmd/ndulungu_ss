import { BookOpen, FileText, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assignments } = await supabase
    .from("teaching_assignments")
    .select("class_name, subject_name")
    .eq("teacher_id", user?.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-gray-600 mt-1">My teaching assignments</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Classes</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{assignments?.length || 0}</p>
            </div>
            <div className="bg-blue-500 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Enter Marks</p>
              <p className="text-sm text-gray-500 mt-1">Pending</p>
            </div>
            <div className="bg-green-500 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Results</p>
              <p className="text-sm text-gray-500 mt-1">View</p>
            </div>
            <div className="bg-purple-500 p-3 rounded-lg">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Teaching Assignments</h3>
        {assignments?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Class</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Subject</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-900">{a.class_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{a.subject_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No assignments yet</p>
        )}
      </div>
    </div>
  );
}
