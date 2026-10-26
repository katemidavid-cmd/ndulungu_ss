import { redirect } from "next/navigation";

export default function TeacherResultsRedirect() {
  redirect("/dashboard/teacher/exams?status=Processed");
}
