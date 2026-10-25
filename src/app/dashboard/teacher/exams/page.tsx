import { ExamManagementPage } from "@/components/dashboard/exam-management-page";

export default function TeacherExamsPage() {
  return (
    <ExamManagementPage
      canManageExams={false}
      dashboardBase="/dashboard/teacher"
    />
  );
}
