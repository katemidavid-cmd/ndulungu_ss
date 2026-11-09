import { MarksEntryPage } from "@/components/dashboard/marks-entry-page";

export default async function HeadmasterMarksPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string | string[] }>;
}) {
  const { examId } = await searchParams;
  return (
    <MarksEntryPage
      dashboardBase="/dashboard/headmaster"
      initialExamId={Array.isArray(examId) ? examId[0] : examId}
    />
  );
}
