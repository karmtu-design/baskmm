// Blocks of the home page. Each one is small and reads only what it shows;
// the slow one (news) is wrapped in <Suspense> by the page.
import Link from "next/link";
import { Column, Row, Text } from "@once-ui-system/core";
import { tr, loc, currentLocale } from "@/i18n";
import { Panel } from "@/components/ui";
import { getNews } from "@/lib/data";
import { daysUntil, type License, type PotentialProject, type Task } from "@/lib/types";

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 0",
  textDecoration: "none",
  borderTop: "1px solid var(--neutral-alpha-weak)",
};
const muted = (s: React.ReactNode) => (
  <Text variant="body-default-xs" onBackground="neutral-weak">
    {s}
  </Text>
);
const num = (v: number, d = 0) => v.toLocaleString(loc(), { maximumFractionDigits: d });

// ---------- key figures ----------

export function KeyFigures({ licenses, projects, tasks, docs }: { licenses: License[]; projects: PotentialProject[]; tasks: Task[]; docs: number }) {
  const area = licenses.reduce((s, l) => s + (l.area_sq_km ?? 0), 0);
  const active = projects.filter((p) => p.stage !== "Отложен" && p.stage !== "Отклонён").length;
  const open = tasks.filter((t) => t.status !== "done");
  const late = open.filter((t) => (daysUntil(t.due_date) ?? 0) < 0).length;
  const soon = licenses.filter((l) => {
    const d = daysUntil(l.expiry_date);
    return d != null && d >= 0 && d <= 365;
  }).length;
  const tiles: { label: string; value: string; note?: string; href: string; warn?: boolean }[] = [
    { label: tr("Лицензий"), value: num(licenses.length), note: tr("истекают в течение года") + `: ${soon}`, href: "/licenses", warn: soon > 0 },
    { label: tr("Площадь, км²"), value: num(area, 1), note: tr("площадь по лицензиям"), href: "/stats" },
    { label: tr("Проектов в работе"), value: num(active), note: tr("всего") + `: ${projects.length}`, href: "/projects" },
    { label: tr("Открытых задач"), value: num(open.length), note: late ? tr("просрочено: {0}", { 0: late }) : tr("без просрочек"), href: "/tasks", warn: late > 0 },
    { label: tr("Документов"), value: num(docs), note: tr("поиск по тексту"), href: "/documents" },
  ];
  return (
    <div className="kpi-grid">
      {tiles.map((t) => (
        <Link key={t.href} href={t.href} className="kpi-tile">
          <span className="kpi-label">{t.label}</span>
          <span className="kpi-value">{t.value}</span>
          {t.note && <span className={t.warn ? "kpi-note kpi-warn" : "kpi-note"}>{t.note}</span>}
        </Link>
      ))}
    </div>
  );
}

// ---------- news ----------

const ago = (iso: string | null) => {
  if (!iso) return "";
  const h = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 3600e3));
  return h < 24 ? tr("{0} ч назад", { 0: h }) : new Date(iso).toLocaleDateString(loc(), { day: "numeric", month: "short", timeZone: "Asia/Almaty" });
};

export async function IndustryNews() {
  const items = await getNews(currentLocale());
  return (
    <Panel title={tr("Новости отрасли")} padding="16">
      {!items || items.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Новости сейчас недоступны. Попробуйте обновить страницу позже.")}</Text>
      ) : (
        <Column>
          {items.map((n) => (
            <a key={n.link} href={n.link} target="_blank" rel="noreferrer" style={{ ...row, display: "block" }}>
              <Text variant="label-default-s" onBackground="neutral-strong" style={{ display: "block" }}>
                {n.title}
              </Text>
              {muted([n.source, ago(n.date)].filter(Boolean).join(" · "))}
            </a>
          ))}
        </Column>
      )}
      {muted(tr("Подборка Google News по горной отрасли Казахстана за две недели. Ссылки открываются на сайтах изданий."))}
    </Panel>
  );
}

export function PanelSkeleton({ title }: { title: string }) {
  return (
    <Panel title={title} padding="16">
      <div className="skeleton-lines" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </Panel>
  );
}
