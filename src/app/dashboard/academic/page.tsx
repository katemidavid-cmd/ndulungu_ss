import { BookOpen, Users, FileText, ClipboardList } from "lucide-react";

export default function AcademicDashboard() {
  const stats = [
    { label: "Classes", value: "12", icon: BookOpen, color: "bg-blue-500" },
    { label: "Subjects", value: "28", icon: ClipboardList, color: "bg-green-500" },
    { label: "Teachers", value: "24", icon: Users, color: "bg-purple-500" },
    { label: "Pending Results", value: "5", icon: FileText, color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-gray-600 mt-1">Academic management overview</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
