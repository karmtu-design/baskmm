import { notFound } from "next/navigation";
import LicensesMap from "@/components/LicensesMap";
import { ButtonLink, LicenseTable, PageHeader } from "@/components/ui";
import { getCompany, getLicenses } from "@/lib/data";
import { updateCompany } from "../../actions";

const FIELDS: { key: string; label: string; wide?: boolean; multiline?: boolean }[] = [
  { key: "name", label: "Наименование", wide: true },
  { key: "bin", label: "БИН" },
  { key: "director", label: "Руководитель" },
  { key: "legal_address", label: "Юридический адрес", wide: true },
  { key: "contacts", label: "Контакты", wide: true },
  { key: "founders_share", label: "Учредители и доля Bask", wide: true },
  { key: "notes", label: "Примечания", wide: true, multiline: true },
];

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(Number(id));
  if (!company) notFound();
  const licenses = await getLicenses({ companyId: company.id });
  const update = updateCompany.bind(null, company.id);
  const value = (k: string) => (company as Record<string, unknown>)[k] as string | null;

  return (
    <>
      <PageHeader
        back={{ href: "/companies", label: "Все компании" }}
        title={company.name}
        subtitle={company.bin ? `БИН ${company.bin}` : "БИН не указан"}
        actions={<ButtonLink href={`/licenses/new?company=${company.id}`} primary>Добавить лицензию</ButtonLink>}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 font-semibold">Лицензии</h2>
            <LicenseTable licenses={licenses} showCompany={false} />
          </div>
          {licenses.some((l) => l.contour) && <LicensesMap licenses={licenses} height={380} />}
        </div>

        <aside className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-semibold">Реквизиты</h2>
          <dl className="mt-3 space-y-3 text-sm">
            {FIELDS.slice(1).map((f) => (
              <div key={f.key}>
                <dt className="text-muted">{f.label}</dt>
                <dd className="whitespace-pre-line">{value(f.key) || "—"}</dd>
              </div>
            ))}
          </dl>
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-medium text-patina">Изменить реквизиты</summary>
            <form action={update} className="mt-3 space-y-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="block text-sm">
                  {f.label}
                  {f.multiline ? (
                    <textarea
                      name={f.key}
                      defaultValue={value(f.key) ?? ""}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
                    />
                  ) : (
                    <input
                      name={f.key}
                      defaultValue={value(f.key) ?? ""}
                      required={f.key === "name"}
                      className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
                    />
                  )}
                </label>
              ))}
              <button className="rounded-md bg-patina px-4 py-2 text-sm font-medium text-white hover:bg-patina-deep">
                Сохранить реквизиты
              </button>
            </form>
          </details>
        </aside>
      </section>
    </>
  );
}
