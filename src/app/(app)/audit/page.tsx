import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import Link from "next/link";
import { Column, Row } from "@once-ui-system/core";
import AuditList from "@/components/AuditList";
import { PageHeader } from "@/components/ui";
import { getAudit } from "@/lib/data";
import { TABLES } from "@/lib/auditText";
import { createClient } from "@/lib/supabase/server";

export const generateMetadata = pageTitle("Журнал изменений");

/** Current names of the objects mentioned in the log, so links show today's names. */
async function namesFor(entries: { table_name: string; record_id: number | null }[]) {
  const supabase = await createClient();
  const by = new Map<string, number[]>();
  for (const e of entries) if (e.record_id != null) by.set(e.table_name, [...(by.get(e.table_name) ?? []), e.record_id]);
  const cols: Record<string, string> = {
    licenses: "id, deposit_name, license_number",
    companies: "id, name",
    potential_projects: "id, name",
    documents: "id, title",
    presentations: "id, title",
    tasks: "id, title",
    map_overlays: "id, title",
    drillholes: "id, hole_id",
  };
  const names = new Map<string, string>();
  await Promise.all(
    [...by].map(async ([table, ids]) => {
      if (!cols[table]) return;
      const { data } = await supabase.from(table).select(cols[table]).in("id", [...new Set(ids)]);
      for (const r of (data ?? []) as unknown as Record<string, unknown>[])
        names.set(`${table}:${r.id}`, String(r.deposit_name || r.name || r.title || r.license_number || r.hole_id || r.id));
    })
  );
  return names;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; before?: string }> }) {
  const { table, before } = await searchParams;
  const t = table && TABLES[table] ? table : undefined;
  const entries = await getAudit({ table: t, before: before ? Number(before) : undefined, limit: 100 });
  const names = await namesFor(entries);
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
