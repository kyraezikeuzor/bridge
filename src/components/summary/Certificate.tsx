import type { HoursRequest } from "@/lib/airtable";
import { formatDate, formatHours } from "./format";

type CertificateProps = {
  firstName: string;
  lastName: string;
  role: string;
  tracks: string;
  rows: HoursRequest[];
  total: number;
  printedAt: string;
};

export function Certificate({ firstName, lastName, role, tracks, rows, total, printedAt }: CertificateProps) {
  return (
    <div id="hours-certificate" className="hidden bg-white p-8 text-black">
      <div className="flex items-start justify-between"><p className="text-lg italic">Omelora Volunteer Program</p><div className="text-right text-sm"><p>Page 1 of 1</p><p>{printedAt}</p></div></div>
      <table className="mt-8 w-full border-collapse text-sm">
        <thead><tr className="text-gray-500"><th className="w-1/2 pb-2 text-left font-normal">Job</th><th className="pb-2 text-left font-normal">Start</th><th className="pb-2 text-right font-normal">Hours</th></tr></thead>
        <tbody>
          <tr className="bg-gray-200"><td className="px-2 py-2 font-bold" colSpan={2}>{lastName ? `${lastName}, ${firstName}` : firstName || "Volunteer"}</td><td className="whitespace-nowrap px-2 py-2 text-right text-sm">Role: {role} &nbsp;|&nbsp; Track: {tracks}</td></tr>
          {rows.map((row) => <tr key={row.id}><td className="px-2 py-1.5">{row.activityName || "—"}</td><td className="px-2 py-1.5">{formatDate(row.startDate)}</td><td className="px-2 py-1.5 text-right">{formatHours(row.hoursRequested ?? 0)}</td></tr>)}
        </tbody>
        <tfoot><tr className="border-t-2 border-black"><td className="px-2 pt-2 italic" colSpan={2}>Count: {rows.length}</td><td className="px-2 pt-2 text-right">{formatHours(total)}</td></tr></tfoot>
      </table>
    </div>
  );
}
