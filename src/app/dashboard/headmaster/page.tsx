import { Users, GraduationCap, FileText, BookOpen } from "lucide-react";

export default function HeadmasterDashboard() {
  const stats = [
    { label: "Teachers", value: "24", icon: Users, color: "bg-blue-500" },
    { label: "Students", value: "856", icon: GraduationCap, color: "bg-green-500" },
    { label: "Classes", value: "12", icon: BookOpen, color: "bg-purple-500" },
    { label: "Results", value: "Published", icon: FileText, color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-gray-600 mt-1">Welcome to the Headmaster dashboard</p>
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <p className="text-gray-600">No recent activity</p>
      </div>
    </div>
  );
}
