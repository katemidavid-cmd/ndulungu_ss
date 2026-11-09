import { MarksEntryPage } from "@/components/dashboard/marks-entry-page";

export default async function TeacherMarksPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string | string[] }>;
}) {
  const { examId } = await searchParams;
  return (
    <MarksEntryPage
      dashboardBase="/dashboard/teacher"
      initialExamId={Array.isArray(examId) ? examId[0] : examId}
    />
  );
}
