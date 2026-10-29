import Link from "next/link";
import { Button, Column, Row, Text } from "@once-ui-system/core";
import { PageHeader, Panel } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";
import { createCompany } from "../actions";

export default async function CompaniesPage() {
  const [companies, licenses] = await Promise.all([getCompanies(), getLicenses()]);
  return (
    <Column gap="32">
      <PageHeader title="Компании группы" subtitle="Недропользователи под управлением BASK Metals and Mining" />

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Компания</th>
              <th>БИН</th>
              <th>Руководитель</th>
              <th>Разведка</th>
              <th>Добыча</th>
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
            <summary>Добавить компанию</summary>
            <form action={createCompany} style={{ marginTop: 16 }}>
              <Column gap="12">
                <label className="field-label">
                  Наименование
                  <input name="name" required className="field" />
                </label>
                <Row gap="12" s={{ direction: "column" }}>
                  <label className="field-label" style={{ flex: 1 }}>
                    БИН
                    <input name="bin" inputMode="numeric" className="field" />
                  </label>
                  <label className="field-label" style={{ flex: 1 }}>
                    Руководитель
                    <input name="director" className="field" />
                  </label>
                </Row>
                <Row>
                  <Button type="submit" prefixIcon="plus">
                    Добавить компанию
                  </Button>
                </Row>
                <Text variant="body-default-xs" onBackground="neutral-weak">
                  Остальные реквизиты можно заполнить в карточке компании.
                </Text>
              </Column>
            </form>
          </details>
        </Panel>
      </Column>
    </Column>
  );
}
