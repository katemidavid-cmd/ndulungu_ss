import Link from "next/link";
import { siteUrl } from "@/lib/site-url";

export default function HomePage() {
  const schoolStructuredData = {
    "@context": "https://schema.org",
    "@type": "School",
    name: "Ndulungu Secondary School",
    alternateName: ["Ndulungu SS", "Ndulungu RMS", "Ndulungu R.M.S."],
    description:
      "The official website of Ndulungu Secondary School and its school results management system.",
    url: siteUrl,
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schoolStructuredData),
        }}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-semibold tracking-tight text-slate-900">
            Ndulungu Secondary School
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Sign in to the system
          </Link>
        </div>
      </header>

      <section className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.3fr_0.7fr] md:items-center md:py-28">
          <div>
            <p className="mb-5 inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">
              Ndulungu SS · Ndulungu RMS
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Welcome to Ndulungu Secondary School
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              This is the official website of Ndulungu Secondary School, also
              known as Ndulungu SS. Ndulungu RMS is the school system for
              managing students, classes, subjects, and academic results.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                Open Ndulungu RMS
              </Link>
              <a
                href="#kuhusu"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                About the system
              </a>
            </div>
          </div>

          <aside
            id="kuhusu"
            className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold tracking-tight">
              Ndulungu Results Management System
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              A digital system that helps school staff securely manage student,
              class, teacher, subject, and results information in one place.
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Search for the school using Ndulungu Secondary School, Ndulungu
              SS, or Ndulungu RMS.
            </p>
          </aside>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Ndulungu Secondary School (Ndulungu SS)</p>
          <p>Ndulungu Results Management System (Ndulungu RMS)</p>
        </div>
      </footer>
    </main>
  );
}
