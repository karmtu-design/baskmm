import Link from "next/link";
import { Text } from "@once-ui-system/core";
import { TABLES, fieldLabel, recordName, valueText, verb } from "@/lib/auditText";
import type { AuditEntry } from "@/lib/types";

const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** The change log as a readable list: who, when, what, and old → new for each changed field. */
export default function AuditList({ entries, names, showObject = true }: { entries: AuditEntry[]; names: Map<string, string>; showObject?: boolean }) {
  if (!entries.length)
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Изменений пока нет. Журнал ведётся с момента его включения.
      </Text>
    );
  return (
    <ol className="audit-list">
      {entries.map((e) => {
        const t = TABLES[e.table_name];
        const name = recordName(e, names);
        const href = e.op !== "DELETE" && e.record_id != null ? t?.link(e.record_id) : null;
        const fields = Object.entries(e.changed ?? {});
        return (
          <li key={e.id} className={`audit-${e.op.toLowerCase()}`}>
            <div className="audit-head">
              <span className="audit-who">{e.actor_email ?? "—"}</span> {verb(e)}
              {showObject && (
                <>
                  {" "}
                  {t?.one ?? e.table_name} {href ? <Link href={href}>{name}</Link> : <b>{name}</b>}
                </>
              )}
              <time dateTime={e.ts}>{when(e.ts)}</time>
            </div>
            {fields.length > 0 && (
              <ul className="audit-fields">
                {fields.slice(0, 12).map(([k, [a, b]]) => (
                  <li key={k}>
                    <span className="audit-field">{fieldLabel(k)}:</span> <s>{valueText(k, a)}</s> → <span>{valueText(k, b)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
