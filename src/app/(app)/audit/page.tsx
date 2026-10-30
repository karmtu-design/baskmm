import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import Link from "next/link";
import { Column, Row } from "@once-ui-system/core";
import AuditList from "@/components/AuditList";
import { PageHeader } from "@/components/ui";
import { getAudit, getAuditNames } from "@/lib/data";
import { TABLES } from "@/lib/auditText";

export const generateMetadata = pageTitle("Журнал изменений");

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; before?: string }> }) {
  const { table, before } = await searchParams;
  const t = table && TABLES[table] ? table : undefined;
  const entries = await getAudit({ table: t, before: before ? Number(before) : undefined, limit: 100 });
  const names = await getAuditNames(entries);
  const q = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <Column>
      <PageHeader title={tr("Журнал изменений")} subtitle={tr("Кто, когда и что изменил в лицензиях, компаниях, проектах, документах и задачах. Записи нельзя изменить или удалить.")} />
      <Row as="nav" gap="4" wrap marginBottom="16" aria-label={tr("Что показать")}>
        <Link className={`chip${!t ? " is-on" : ""}`} href="/audit">{tr("Всё")}</Link>
        {Object.entries(TABLES).map(([k, v]) => (
          <Link key={k} className={`chip${t === k ? " is-on" : ""}`} href={`/audit${q({ table: k })}`}>
            {v.one[0].toUpperCase() + v.one.slice(1)}
          </Link>
        ))}
      </Row>
      <AuditList entries={entries} names={names} />
      {entries.length === 100 && (
        <Row marginTop="16">
          <Link className="chip" href={`/audit${q({ table: t, before: String(entries[entries.length - 1].id) })}`}>{tr("Показать более ранние →")}</Link>
        </Row>
      )}
    </Column>
  );
}
