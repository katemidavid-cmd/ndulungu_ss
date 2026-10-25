import { ExamResultsPage } from "@/components/dashboard/exam-results-page";

export default async function HeadmasterExamResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ExamResultsPage
      examId={id}
      examsHref="/dashboard/headmaster/exams"
    />
  );
}
