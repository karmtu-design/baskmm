import Link from "next/link";
import LicensesMap from "@/components/LicensesMap";
import { ExpiryText, Legend, PageHeader, StatusBadge, ButtonLink } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";
import { daysUntil, isTest } from "@/lib/types";

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export default async function Overview() {
  const [companies, licenses] = await Promise.all([getCompanies(), getLicenses()]);
  const exploration = licenses.filter((l) => l.license_type === "Разведка").length;
  const mining = licenses.filter((l) => l.license_type === "Добыча").length;
  const deadlines = licenses
    .map((l) => ({ l, d: daysUntil(l.expiry_date) }))
    .filter((x) => x.d != null && x.d <= 365)
    .sort((a, b) => a.d! - b.d!);
  const anyTest = licenses.some(isTest);

  return (
    <>
      <PageHeader
        title="Портфель группы"
        subtitle={
          <>
            {plural(companies.length, "компания", "компании", "компаний")},{" "}
            {plural(licenses.length, "лицензия", "лицензии", "лицензий")}: {exploration} на разведку и {mining} на
            добычу.
          </>
        }
        actions={<ButtonLink href="/licenses/new" primary>Добавить лицензию</ButtonLink>}
      />

      {anyTest && (
        <p className="mb-4 rounded-md border border-dashed border-ochre bg-ochre/8 px-4 py-2.5 text-sm">
          Сейчас в системе тестовые лицензии и условные контуры. Замените их реальными данными после настройки
          входа для сотрудников.
        </p>
      )}

      <section className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          <LicensesMap licenses={licenses} height={560} />
          <div className="mt-3">
            <Legend licenses={licenses} />
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-semibold">Сроки в ближайший год</h2>
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted">Ни одна лицензия не истекает в ближайшие 12 месяцев.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {deadlines.map(({ l }) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <Link href={`/licenses/${l.id}`} className="font-medium hover:text-patina">
                        {l.deposit_name}
                      </Link>
                      <div className="text-xs text-muted">{l.company_name}</div>
                    </div>
                    <div className="text-right">
                      <ExpiryText date={l.expiry_date} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Компании</h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {companies.map((c) => {
                const own = licenses.filter((l) => l.company_id === c.id);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/companies/${c.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-paper/60"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted">
                        {plural(own.length, "лицензия", "лицензии", "лицензий")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {licenses.some((l) => l.status && l.status !== "действует") && (
            <section>
              <h2 className="mb-2 font-semibold">Требуют внимания</h2>
              <ul className="space-y-2 text-sm">
                {licenses
                  .filter((l) => l.status && l.status !== "действует")
                  .map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3">
                      <Link href={`/licenses/${l.id}`} className="hover:text-patina">
                        {l.deposit_name}
                      </Link>
                      <StatusBadge status={l.status} />
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </>
  );
}
