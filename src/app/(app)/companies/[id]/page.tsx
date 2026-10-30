import { tr } from "@/i18n";
import { notFound } from "next/navigation";
import { Button, Column, Grid, Text } from "@once-ui-system/core";
import LicensesMap from "@/components/LicensesMap";
import { ButtonLink, LicenseTable, PageHeader, Panel } from "@/components/ui";
import { getCompany, getLicenses } from "@/lib/data";
import { updateCompany } from "../../actions";

const FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "name", label: "Наименование" },
  { key: "bin", label: "БИН" },
  { key: "director", label: "Руководитель" },
  { key: "legal_address", label: "Юридический адрес" },
  { key: "contacts", label: "Контакты" },
  { key: "founders_share", label: "Учредители и доля Bask" },
  { key: "notes", label: "Примечания", multiline: true },
];

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(Number(id));
  if (!company) notFound();
  const licenses = await getLicenses({ companyId: company.id });
  const update = updateCompany.bind(null, company.id);
  const value = (k: string) => (company as Record<string, unknown>)[k] as string | null;

  return (
    <Column>
      <PageHeader
        back={{ href: "/companies", label: tr("Все компании") }}
        title={company.name}
        subtitle={company.bin ? tr("БИН {0}", { 0: company.bin }) : tr("БИН не указан")}
        actions={
          <ButtonLink href={`/licenses/new?company=${company.id}`} primary>{tr("Добавить лицензию")}</ButtonLink>
        }
      />

      <Grid columns="3" gap="24" m={{ columns: "1" }}>
        <Column gap="24" className="span-2">
          <LicenseTable licenses={licenses} showCompany={false} />
          {licenses.some((l) => l.contour) && <LicensesMap licenses={licenses} height={380} />}
        </Column>

        <Panel title={tr("Реквизиты")}>
          <Column as="dl" gap="12" style={{ margin: 0 }}>
            {FIELDS.slice(1).map((f) => (
              <Column key={f.key} gap="2">
                <Text as="dt" variant="label-default-s" onBackground="neutral-weak">
                  {tr(f.label)}
                </Text>
                <Text as="dd" variant="body-default-s" style={{ margin: 0, whiteSpace: "pre-line" }}>
                  {value(f.key) || "—"}
                </Text>
              </Column>
            ))}
          </Column>
          <details style={{ borderTop: "1px solid var(--neutral-alpha-weak)", paddingTop: 16 }}>
            <summary>{tr("Изменить реквизиты")}</summary>
            <form action={update} style={{ marginTop: 12 }}>
              <Column gap="12">
                {FIELDS.map((f) => (
                  <label key={f.key} className="field-label">
                    {tr(f.label)}
                    {f.multiline ? (
                      <textarea name={f.key} defaultValue={value(f.key) ?? ""} rows={3} className="field" />
                    ) : (
                      <input name={f.key} defaultValue={value(f.key) ?? ""} required={f.key === "name"} className="field" />
                    )}
                  </label>
                ))}
                <Button type="submit">{tr("Сохранить реквизиты")}</Button>
              </Column>
            </form>
          </details>
        </Panel>
      </Grid>
    </Column>
  );
}
