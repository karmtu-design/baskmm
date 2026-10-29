import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";
import { createCompany } from "../actions";

export default async function CompaniesPage() {
  const [companies, licenses] = await Promise.all([getCompanies(), getLicenses()]);
  return (
    <>
      <PageHeader
        title="Компании группы"
        subtitle="Недропользователи под управлением Bask Metals and Mining"
      />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Компания</th>
              <th className="px-4 py-3 font-medium">БИН</th>
              <th className="px-4 py-3 font-medium">Руководитель</th>
              <th className="px-4 py-3 font-medium">Разведка</th>
              <th className="px-4 py-3 font-medium">Добыча</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const own = licenses.filter((l) => l.company_id === c.id);
              return (
                <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${c.id}`} className="font-medium hover:text-patina">
                      {c.name}
                    </Link>
                    {c.notes && <div className="text-xs text-muted">{c.notes}</div>}
                  </td>
                  <td className="px-4 py-3">{c.bin || "—"}</td>
                  <td className="px-4 py-3">{c.director || "—"}</td>
                  <td className="px-4 py-3">{own.filter((l) => l.license_type === "Разведка").length}</td>
                  <td className="px-4 py-3">{own.filter((l) => l.license_type === "Добыча").length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="mt-6 max-w-xl rounded-lg border border-line bg-surface p-4">
        <summary className="cursor-pointer font-medium">Добавить компанию</summary>
        <form action={createCompany} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Наименование
            <input name="name" required className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            БИН
            <input name="bin" inputMode="numeric" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            Руководитель
            <input name="director" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-md bg-patina px-4 py-2 text-sm font-medium text-white hover:bg-patina-deep">
              Добавить компанию
            </button>
          </div>
        </form>
      </details>
    </>
  );
}
