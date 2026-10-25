import { ExamManagementPage } from "@/components/dashboard/exam-management-page";

export default function AcademicExamsPage() {
  return (
    <ExamManagementPage
      canManageExams
      dashboardBase="/dashboard/academic"
    />
  );
}
