import { MarksEntryPage } from "@/components/dashboard/marks-entry-page";

export default async function AcademicMarksPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string | string[] }>;
}) {
  const { examId } = await searchParams;
  return (
    <MarksEntryPage
      dashboardBase="/dashboard/academic"
      initialExamId={Array.isArray(examId) ? examId[0] : examId}
    />
  );
}
