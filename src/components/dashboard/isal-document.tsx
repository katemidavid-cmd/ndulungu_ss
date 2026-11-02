"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { sortStudentsForDisplay } from "@/lib/student-sort";

type StudentEntry = {
  id: string;
  full_name: string;
  sex?: string | null;
};

type ExamRecord = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date?: string | null;
  end_date?: string | null;
};

type SubjectRecord = {
  id: string;
  name: string;
  subject_code?: string | null;
};

export function ISALDocument({
  exam,
  subject,
  students,
  schoolName,
  dashboardBase,
}: {
  exam: ExamRecord;
  subject: SubjectRecord;
  students: StudentEntry[];
  schoolName: string;
  dashboardBase: string;
}) {
  const sortedStudents = sortStudentsForDisplay(students);
  const femaleCount = sortedStudents.filter((student) =>
    (student.sex ?? "").trim().toUpperCase() === "F" ||
    (student.sex ?? "").trim().toUpperCase() === "FEMALE" ||
    (student.sex ?? "").trim().toUpperCase() === "GIRL",
  ).length;
  const maleCount = sortedStudents.filter((student) =>
    (student.sex ?? "").trim().toUpperCase() === "M" ||
    (student.sex ?? "").trim().toUpperCase() === "MALE" ||
    (student.sex ?? "").trim().toUpperCase() === "BOY",
  ).length;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;

    const rows = sortedStudents
      .map(
        (student, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${(student.full_name ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
            <td>${(student.sex ?? "—").toUpperCase()}</td>
            <td><span class="signature-box" aria-label="Student signature"></span></td>
            <td><span class="signature-box" aria-label="Student marks"></span></td>
          </tr>
        `,
      )
      .join("");

    const printHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${(exam.name ?? "ISAL").replace(/</g, "&lt;")}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: Arial, Helvetica, sans-serif;
            }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .doc {
              width: 100%;
              box-sizing: border-box;
              padding: 0;
              background: #fff;
            }
            .header {
              text-align: center;
              border-bottom: 1px solid #000;
              padding-bottom: 12px;
              margin-bottom: 12px;
            }
            .school { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
            h1 { margin: 8px 0 4px; font-size: 22px; text-transform: uppercase; }
            .meta { font-size: 12px; }
            .summary { text-align: right; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 8px 0; }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              border: 1px solid #000;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px 4px;
              text-align: center;
              vertical-align: top;
              font-size: 11px;
            }
            th { background: #f3f4f6; }
            th:nth-child(2), td:nth-child(2) { text-align: left; }
            .name-col { width: 38%; }
            .sn-col { width: 8%; }
            .gender-col { width: 12%; }
            .signature-col { width: 22%; }
            .marks-col { width: 20%; }
            tbody tr { break-inside: avoid; page-break-inside: avoid; }
            .signature-box {
              display: block;
              width: 100%;
              min-height: 10mm;
              border-bottom: 1px solid #000;
              box-sizing: border-box;
            }
            .footer {
              margin-top: 18px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              font-size: 11px;
            }
            .signature-block {
              border-top: 1px solid #000;
              padding-top: 8px;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="doc">
            <div class="header">
              <div class="school">${(schoolName ?? "School Name").replace(/</g, "&lt;")}</div>
              <h1>Individual Subject Attendance List</h1>
              <div class="meta">${(exam.name ?? "").replace(/</g, "&lt;")} — ${(exam.term ?? "").replace(/</g, "&lt;")} — ${(exam.academic_year ?? "").replace(/</g, "&lt;")}</div>
              <div class="meta">Class/Form: ${(exam.class_form ?? "").replace(/</g, "&lt;")}</div>
              <div class="meta">Subject: ${(subject.name ?? "").replace(/</g, "&lt;")} ${subject.subject_code ? `Code: ${subject.subject_code}` : ""}</div>
            </div>

            <div class="summary">Total: ${sortedStudents.length} | Female: ${femaleCount} | Male: ${maleCount}</div>

            <table>
              <colgroup>
                <col class="sn-col" />
                <col class="name-col" />
                <col class="gender-col" />
                <col class="signature-col" />
                <col class="marks-col" />
              </colgroup>
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Student Full Name</th>
                  <th>Gender</th>
                  <th>Signature</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <div class="footer">
              <div class="signature-block">
                <div><strong>Invigilator 1</strong></div>
                <div>Name: ______________________________</div>
                <div>Signature: _________________________</div>
              </div>
              <div class="signature-block">
                <div><strong>Invigilator 2</strong></div>
                <div>Name: ______________________________</div>
                <div>Signature: _________________________</div>
              </div>
              <div class="signature-block">
                <div><strong>Subject Teacher</strong></div>
                <div>Name: ______________________________</div>
                <div>Signature: _________________________</div>
              </div>
              <div class="signature-block">
                <div><strong>Date</strong></div>
                <div>_______________________________</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body,
          body * {
            visibility: visible !important;
          }

          body *:not(.isal-print-shell):not(:has(.isal-print-shell)):not(.isal-print-shell *) {
            display: none !important;
          }

          body:has(.isal-print-shell),
          body *:has(.isal-print-shell) {
            display: block !important;
            position: static !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .isal-print-shell,
          .isal-print-shell * {
            visibility: visible !important;
          }

          .isal-print-shell {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .isal-document {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
            height: auto !important;
            border: 1px solid #000 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .isal-document table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 11px !important;
          }

          .isal-document thead {
            display: table-header-group;
          }

          .isal-document tr,
          .isal-document th,
          .isal-document td,
          .isal-document .signature-block {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .isal-document th,
          .isal-document td {
            border: 1px solid #000 !important;
          }

          .isal-document .signature-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        .isal-print-shell {
          width: 100%;
        }

        .isal-document {
          background: #fff;
          color: #000;
          border: 1px solid #000;
        }

        .isal-document table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          border: 1px solid #000;
        }

        .isal-document th,
        .isal-document td {
          border: 1px solid #000;
          vertical-align: top;
          color: #000;
          text-align: left;
        }

        .isal-document th {
          background: #f5f5f5;
          font-weight: 700;
        }

        .isal-document tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .isal-document .sn-col { width: 8%; }
        .isal-document .name-col { width: 36%; }
        .isal-document .gender-col { width: 10%; }
        .isal-document .signature-col { width: 24%; }
        .isal-document .marks-col { width: 22%; }

        .signature-box {
          display: block;
          width: 100%;
          min-height: 10mm;
          border-bottom: 1px solid #000;
          background: transparent;
        }
      `}</style>

      <div className="isal-print-shell mx-auto w-full max-w-6xl space-y-4 pb-10">
        <div className="no-print flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Link
            href={`${dashboardBase}/exams/${exam.id}/isal`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to ISAL list
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>

        <div className="isal-document rounded-2xl bg-white p-4 sm:p-6">
          <header className="border-b border-black pb-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-800">
              {schoolName}
            </p>
            <h1 className="mt-2 text-xl font-black uppercase tracking-wide text-black">
              Individual Subject Attendance List
            </h1>
            <p className="mt-1 text-sm font-semibold text-black">
              {exam.name.toUpperCase()} — {exam.term} — {exam.academic_year}
            </p>
            <p className="text-sm text-black">
              Class/Form: <span className="font-bold">{exam.class_form}</span>
            </p>
            <div className="mt-3 flex flex-col gap-1 text-sm text-black sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <span>
                Subject: <span className="font-bold">{subject.name}</span>
              </span>
              {subject.subject_code ? (
                <span>
                  Code: <span className="font-bold">{subject.subject_code}</span>
                </span>
              ) : null}
              <span>
                Date: <span className="font-semibold">__________________</span>
              </span>
            </div>
          </header>

          <div className="mt-4 text-right text-[11px] font-semibold uppercase tracking-wide text-black">
            Total: {sortedStudents.length} | Female: {femaleCount} | Male: {maleCount}
          </div>

          {sortedStudents.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-black bg-white p-6 text-center text-sm text-black">
              No students are registered for this subject in this class.
            </div>
          ) : (
            <div className="mt-4 border border-black">
              <table className="text-left text-[11px] sm:text-xs">
                <colgroup>
                  <col className="sn-col" />
                  <col className="name-col" />
                  <col className="gender-col" />
                  <col className="signature-col" />
                  <col className="marks-col" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-center">S/N</th>
                    <th className="px-2 py-2 text-center">Student Full Name</th>
                    <th className="px-2 py-2 text-center">Gender</th>
                    <th className="px-2 py-2 text-center">Signature</th>
                    <th className="px-2 py-2 text-center">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student, index) => (
                    <tr key={student.id}>
                      <td className="px-2 py-3 text-center font-semibold">{index + 1}</td>
                      <td className="px-2 py-3 font-medium text-black">{student.full_name}</td>
                      <td className="px-2 py-3 text-center font-semibold text-black">
                        {student.sex ? student.sex.toUpperCase() : "—"}
                      </td>
                      <td className="px-2 py-3">
                        <span className="signature-box" aria-label="Student signature" />
                      </td>
                      <td className="px-2 py-3">
                        <span className="signature-box" aria-label="Student marks" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 space-y-4 text-[11px] sm:text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="signature-block border-t border-black pt-2">
                <p className="font-semibold uppercase tracking-wide text-black">Invigilator 1</p>
                <p className="mt-3">Name: ______________________________</p>
                <p className="mt-3">Signature: _________________________</p>
              </div>
              <div className="signature-block border-t border-black pt-2">
                <p className="font-semibold uppercase tracking-wide text-black">Invigilator 2</p>
                <p className="mt-3">Name: ______________________________</p>
                <p className="mt-3">Signature: _________________________</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="signature-block border-t border-black pt-2">
                <p className="font-semibold uppercase tracking-wide text-black">Subject Teacher</p>
                <p className="mt-3">Name: ______________________________</p>
                <p className="mt-3">Signature: _________________________</p>
              </div>
              <div className="signature-block border-t border-black pt-2">
                <p className="font-semibold uppercase tracking-wide text-black">Date</p>
                <p className="mt-3">_______________________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
