import { AcademicPeriodSettings } from "@/components/dashboard/academic-period-settings";

export default function AcademicSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Academic Settings
        </h2>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Set the active academic year and examination term for the school.
        </p>
      </div>
      <AcademicPeriodSettings />
    </div>
  );
}
