import { ExamManagementPage } from "@/components/dashboard/exam-management-page";

export default function HeadmasterExamsPage() {
  return (
    <ExamManagementPage
      canManageExams
      dashboardBase="/dashboard/headmaster"
    />
  );
}
