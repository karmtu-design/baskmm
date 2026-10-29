import Link from "next/link";
import { daysUntil, formatDate, mineralColor, mineralGroup, type License } from "@/lib/types";

export function StatusBadge({ status }: { status: string | null }) {
  const s = status || "—";
  const tone =
    s === "действует"
      ? "bg-patina/10 text-patina"
      : s === "истекла" || s === "приостановлена"
        ? "bg-danger/10 text-danger"
        : "bg-ochre/12 text-ochre";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{s}</span>;
}

export function TestMark() {
  return (
    <span className="ml-2 inline-block rounded border border-dashed border-ochre px-1.5 text-[11px] font-medium text-ochre">
      тестовые данные
    </span>
  );
}

export function MineralSwatch({ mineral }: { mineral: string | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-sm"
        style={{ background: mineralColor(mineral) }}
      />
      {mineral || "—"}
    </span>
  );
}

export function Legend({ licenses }: { licenses: Pick<License, "mineral">[] }) {
  const groups = Array.from(new Set(licenses.map((l) => mineralGroup(l.mineral))));
  const colorOf = (g: string) => mineralColor(licenses.find((l) => mineralGroup(l.mineral) === g)!.mineral);
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
      {groups.map((g) => (
        <li key={g} className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3 w-5 rounded-sm" style={{ background: colorOf(g) }} />
          {g}
        </li>
      ))}
    </ul>
  );
}

export function ExpiryText({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d == null) return <span>—</span>;
  const tone = d < 0 ? "text-danger" : d <= 180 ? "text-ochre" : "";
  const hint = d < 0 ? `истекла ${-d} дн. назад` : d <= 365 ? `через ${d} дн.` : null;
  return (
    <span className={tone}>
      {formatDate(date)}
      {hint && <span className="block text-xs">{hint}</span>}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="text-sm text-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-patina-deep md:text-[28px]">{title}</h1>
          {subtitle && <div className="mt-1 text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function ButtonLink({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3.5 py-2 text-sm font-medium ${
        primary ? "bg-patina text-white hover:bg-patina-deep" : "border border-line bg-surface hover:border-muted"
      }`}
    >
      {children}
    </Link>
  );
}

export function LicenseTable({ licenses, showCompany = true }: { licenses: License[]; showCompany?: boolean }) {
  if (licenses.length === 0)
    return <p className="rounded-lg border border-dashed border-line p-6 text-muted">Лицензий пока нет.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Участок</th>
            <th className="px-4 py-3 font-medium">Полезное ископаемое</th>
            <th className="px-4 py-3 font-medium">Вид</th>
            {showCompany && <th className="px-4 py-3 font-medium">Компания</th>}
            <th className="px-4 py-3 font-medium">Действует до</th>
            <th className="px-4 py-3 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((l) => (
            <tr key={l.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
              <td className="px-4 py-3">
                <Link href={`/licenses/${l.id}`} className="font-medium text-ink hover:text-patina">
                  {l.deposit_name || "Без названия"}
                </Link>
                <div className="text-xs text-muted">{l.license_number}</div>
              </td>
              <td className="px-4 py-3">
                <MineralSwatch mineral={l.mineral} />
              </td>
              <td className="px-4 py-3">
                {l.license_type || "—"}
                {l.category && <span className="text-muted">, {l.category}</span>}
              </td>
              {showCompany && <td className="px-4 py-3">{l.company_name}</td>}
              <td className="px-4 py-3">
                <ExpiryText date={l.expiry_date} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={l.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
