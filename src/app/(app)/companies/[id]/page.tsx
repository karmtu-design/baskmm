import { tr } from "@/i18n";
import { dn, dp } from "@/lib/translit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Column, Grid, Row, Text } from "@once-ui-system/core";
import FoundingDocs from "@/components/FoundingDocs";
import LicensesMap from "@/components/LicensesMap";
import { ButtonLink, LicenseTable, PageHeader, Panel } from "@/components/ui";
import { getCompany, getFoundingDocs, getLicenses } from "@/lib/data";
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

const TABS = [
  { id: "info", label: "Лицензии и реквизиты" },
  { id: "founding", label: "Учредительные документы" },
];

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab = rawTab === "founding" ? "founding" : "info";
  const company = await getCompany(Number(id));
  if (!company) notFound();
  const licenses = tab === "info" ? await getLicenses({ companyId: company.id }) : [];
  const founding = tab === "founding" ? await getFoundingDocs(company.id) : null;
  const update = updateCompany.bind(null, company.id);
  const value = (k: string) => (company as Record<string, unknown>)[k] as string | null;

  return (
    <Column>
      <PageHeader
        back={{ href: "/companies", label: tr("Все компании") }}
        title={dn(company.name)}
        subtitle={company.bin ? tr("БИН {0}", { 0: company.bin }) : tr("БИН не указан")}
        actions={
          <ButtonLink href={`/licenses/new?company=${company.id}`} primary>{tr("Добавить лицензию")}</ButtonLink>
        }
      />

      <Row as="nav" gap="4" marginBottom="24" borderBottom overflowX="auto" aria-label={tr("Разделы компании")} className="tab-row">
        {TABS.map((t) => (
          <Link key={t.id} href={`/companies/${company.id}${t.id === "info" ? "" : `?tab=${t.id}`}`} aria-current={tab === t.id ? "page" : undefined} className="tab-link">
            {t.id === "founding" && <span aria-hidden>🔒 </span>}
            {tr(t.label)}
          </Link>
        ))}
      </Row>

      {founding && (founding.allowed ? (
        <FoundingDocs companyId={company.id} docs={founding.docs} canEdit={founding.canEdit} />
      ) : (
        <div className="founding-locked">
          <span aria-hidden>🔒</span>
          <Text variant="heading-strong-s">{tr("Нет доступа к учредительным документам")}</Text>
          <Text variant="body-default-s" onBackground="neutral-weak">
            {tr("Этот раздел закрыт. Доступ открывает администратор на странице «Сотрудники» — попросите его, если документы нужны вам для работы.")}
          </Text>
        </div>
      ))}

      {tab === "info" && (
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
      )}
    </Column>
  );
}
