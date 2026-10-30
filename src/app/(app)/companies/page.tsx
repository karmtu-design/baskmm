import { tr } from "@/i18n";
import Link from "next/link";
import { Button, Column, Row, Text } from "@once-ui-system/core";
import { PageHeader, Panel } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";
import { createCompany } from "../actions";

export default async function CompaniesPage() {
  const [companies, licenses] = await Promise.all([getCompanies(), getLicenses()]);
  return (
    <Column gap="32">
      <PageHeader title={tr("Компании группы")} subtitle={tr("Недропользователи под управлением BASK Metals and Mining")} />

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{tr("Компания")}</th>
              <th>{tr("БИН")}</th>
              <th>{tr("Руководитель")}</th>
              <th>{tr("Разведка")}</th>
              <th>{tr("Добыча")}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const own = licenses.filter((l) => l.company_id === c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/companies/${c.id}`}>{c.name}</Link>
                    {c.notes && <div style={{ fontSize: 12, color: "var(--neutral-on-background-weak)" }}>{c.notes}</div>}
                  </td>
                  <td>{c.bin || "—"}</td>
                  <td>{c.director || "—"}</td>
                  <td>{own.filter((l) => l.license_type === "Разведка").length}</td>
                  <td>{own.filter((l) => l.license_type === "Добыча").length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Column maxWidth="s">
        <Panel>
          <details>
            <summary>{tr("Добавить компанию")}</summary>
            <form action={createCompany} style={{ marginTop: 16 }}>
              <Column gap="12">
                <label className="field-label">{tr("Наименование")}<input name="name" required className="field" />
                </label>
                <Row gap="12" s={{ direction: "column" }}>
                  <label className="field-label" style={{ flex: 1 }}>{tr("БИН")}<input name="bin" inputMode="numeric" className="field" />
                  </label>
                  <label className="field-label" style={{ flex: 1 }}>{tr("Руководитель")}<input name="director" className="field" />
                  </label>
                </Row>
                <Row>
                  <Button type="submit" prefixIcon="plus">{tr("Добавить компанию")}</Button>
                </Row>
                <Text variant="body-default-xs" onBackground="neutral-weak">{tr("Остальные реквизиты можно заполнить в карточке компании.")}</Text>
              </Column>
            </form>
          </details>
        </Panel>
      </Column>
    </Column>
  );
}
