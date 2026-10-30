// Blocks of the home page. Each one is small and reads only what it shows;
// the slow ones (prices, rates, news, change log) are wrapped in <Suspense> by the page.
import Link from "next/link";
import { Column, Row, Text } from "@once-ui-system/core";
import { tr, loc, currentLocale } from "@/i18n";
import { Panel } from "@/components/ui";
import AuditList from "@/components/AuditList";
import CurrencyConverter from "@/components/CurrencyConverter";
import { getAudit, getAuditNames, getNews, getRates } from "@/lib/data";
import { getMetalBoard } from "@/lib/metals";
import { parseResources, valueOf } from "@/lib/inground";
import { daysUntil, formatDate, PROJECT_STAGES, type DocumentRow, type License, type PotentialProject, type Presentation, type Task } from "@/lib/types";

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
const usd = (v: number) => new Intl.NumberFormat(loc(), { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
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

// ---------- metal in the ground ----------

export async function InGroundValue({ projects }: { projects: PotentialProject[] }) {
  const board = await getMetalBoard();
  const rows = projects
    .filter((p) => p.stage !== "Отклонён")
    .map((p) => {
      const amounts = parseResources(p.resources).map((a) => ({ ...a, value: valueOf(a, board.quotes) }));
      return { p, amounts, total: amounts.reduce((s, a) => s + (a.value ?? 0), 0) };
    })
    .filter((r) => r.amounts.length > 0)
    .sort((a, b) => b.total - a.total);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const missing = projects.filter((p) => p.stage !== "Отклонён").length - rows.length;
  return (
    <Panel title={tr("Металл в недрах по сегодняшним ценам")} padding="16">
      {rows.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">
          {tr("Чтобы здесь появилась оценка, укажите в проекте поле «Запасы / ресурсы» в виде «Cu 120 тыс. т» или «Au 5 т».")}
        </Text>
      ) : (
        <Column>
          {rows.map(({ p, amounts, total }) => (
            <Link key={p.id} href={`/projects/${p.id}`} style={row}>
              <Column gap="2">
                <Text variant="label-strong-s">{p.name}</Text>
                {muted(amounts.map((a) => `${a.symbol} ${num(a.tonnes, a.tonnes < 100 ? 2 : 0)} ${tr("т")}`).join(" · "))}
              </Column>
              <Column horizontal="end" gap="2">
                <Text variant="label-strong-s">{total > 0 ? `≈ ${usd(total)}` : "—"}</Text>
                {amounts.some((a) => a.value == null) &&
                  muted(tr("нет цены: {0}", { 0: amounts.filter((a) => a.value == null).map((a) => a.symbol).join(", ") }))}
              </Column>
            </Link>
          ))}
          <div style={{ ...row, fontWeight: 600 }}>
            <Text variant="label-strong-m">{tr("Итого")}</Text>
            <Text variant="label-strong-m">≈ {usd(total)}</Text>
          </div>
        </Column>
      )}
      {muted(
        tr("Грубая оценка: количество металла из поля «Запасы / ресурсы» × сегодняшняя цена LME. Не учитывает извлечение, затраты и категорию запасов.") +
          (missing > 0 ? " " + tr("Без оценки проектов: {0}.", { 0: missing }) : "")
      )}
    </Panel>
  );
}

// ---------- exchange rates ----------

export async function ExchangeRates() {
  const r = await getRates();
  return (
    <Panel title={tr("Курсы Нацбанка РК")} padding="16">
      {!r ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Курсы сейчас недоступны. Попробуйте обновить страницу позже.")}</Text>
      ) : (
        <Column>
          {r.rates.map((x) => (
            <div key={x.code} style={{ ...row, alignItems: "center" }}>
              <Column gap="2">
                <Text variant="label-strong-s">
                  {x.per > 1 ? `${x.per} ` : ""}
                  {x.code}
                </Text>
                {muted(tr(x.code === "USD" ? "доллар США" : x.code === "CNY" ? "китайский юань" : x.code === "EUR" ? "евро" : "российский рубль"))}
              </Column>
              <Row gap="8" vertical="center">
                <Text variant="label-strong-m">{num(x.rate, 2)} ₸</Text>
                {x.change != null && x.change !== 0 && (
                  <span className={x.change > 0 ? "rate-up" : "rate-down"}>
                    {x.change > 0 ? "▲" : "▼"} {num(Math.abs(x.change), 2)}
                  </span>
                )}
              </Row>
            </div>
          ))}
          <CurrencyConverter rates={r.rates} />
        </Column>
      )}
      {muted(
        <>
          {tr("Официальный курс на {0}, источник:", { 0: r?.date ?? formatDate(new Date().toISOString().slice(0, 10)) })}{" "}
          <a href="https://nationalbank.kz/ru/exchangerates/ezhednevnye-oficialnye-rynochnye-kursy-valyut" target="_blank" rel="noreferrer" style={{ color: "var(--brand-on-background-strong)" }}>
            nationalbank.kz
          </a>
        </>
      )}
    </Panel>
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

// ---------- tasks for the week ----------

export function WeekTasks({ tasks }: { tasks: Task[] }) {
  const list = tasks
    .filter((t) => t.status !== "done" && t.due_date && (daysUntil(t.due_date) ?? 99) <= 7)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 7);
  return (
    <Panel title={tr("Задачи на неделю")} padding="16">
      {list.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("На ближайшие 7 дней сроков нет, просроченных задач нет.")}</Text>
      ) : (
        <Column>
          {list.map((t) => {
            const d = daysUntil(t.due_date)!;
            return (
              <Link key={t.id} href="/tasks" style={row}>
                <Column gap="2">
                  <Text variant="label-strong-s">{t.title}</Text>
                  {muted(t.assignee ?? tr("без исполнителя"))}
                </Column>
                <Text
                  variant="body-default-s"
                  align="right"
                  style={{ color: d < 0 ? "var(--danger-on-background-strong)" : d <= 2 ? "var(--warning-on-background-strong)" : undefined, whiteSpace: "nowrap" }}
                >
                  {formatDate(t.due_date)}
                  <span style={{ display: "block", fontSize: 12 }}>{d < 0 ? tr("просрочено на {0} дн.", { 0: -d }) : d === 0 ? tr("сегодня") : tr("через {0} дн.", { 0: d })}</span>
                </Text>
              </Link>
            );
          })}
        </Column>
      )}
    </Panel>
  );
}

// ---------- project funnel ----------

export function ProjectFunnel({ projects }: { projects: PotentialProject[] }) {
  const stages = PROJECT_STAGES.filter((s) => s !== "Отложен" && s !== "Отклонён");
  const counts = stages.map((s) => ({ s, n: projects.filter((p) => p.stage === s).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const parked = projects.filter((p) => p.stage === "Отложен" || p.stage === "Отклонён").length;
  return (
    <Panel title={tr("Воронка проектов")} padding="16">
      <Column gap="8">
        {counts.map(({ s, n }) => (
          <Link key={s} href={`/projects?stage=${encodeURIComponent(s)}`} className="funnel-row" title={`${tr(s)}: ${n}`}>
            <span className="funnel-label">{tr(s)}</span>
            <span className="funnel-track">
              <span className="funnel-bar" style={{ width: `${Math.max(n ? 6 : 0, (n / max) * 100)}%` }} />
            </span>
            <span className="funnel-n">{n}</span>
          </Link>
        ))}
      </Column>
      {parked > 0 && muted(tr("Отложено или отклонено: {0}", { 0: parked }))}
    </Panel>
  );
}

// ---------- recent changes ----------

export async function RecentChanges() {
  const entries = await getAudit({ limit: 6 });
  const names = await getAuditNames(entries);
  return (
    <Panel title={tr("Последние изменения")} padding="16">
      <AuditList entries={entries} names={names} compact />
      <Text variant="body-default-xs">
        <Link href="/audit" style={{ color: "var(--brand-on-background-strong)" }}>
          {tr("Весь журнал изменений →")}
        </Link>
      </Text>
    </Panel>
  );
}

// ---------- recent files ----------

export function RecentFiles({ presentations, documents }: { presentations: Presentation[]; documents: DocumentRow[] }) {
  const files = [
    ...presentations.map((p) => ({ key: `p${p.id}`, title: p.title, what: tr("Презентация"), at: p.created_at, href: "/presentations", ext: p.file_name })),
    ...documents.map((d) => ({
      key: `d${d.id}`,
      title: d.title,
      what: d.category ? tr(d.category) : tr("Документ"),
      at: d.created_at,
      href: d.license_id ? `/licenses/${d.license_id}?tab=${d.kind === "history" ? "history" : "info"}` : d.project_id ? `/projects/${d.project_id}` : "/documents",
      ext: d.file_name,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  return (
    <Panel title={tr("Свежие файлы")} padding="16">
      {files.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Файлов пока нет.")}</Text>
      ) : (
        <Column>
          {files.map((f) => (
            <Link key={f.key} href={f.href} style={{ ...row, alignItems: "center" }}>
              <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
                <span className="file-ext">{(f.ext.split(".").pop() ?? "").toUpperCase().slice(0, 4)}</span>
                <Column gap="2" style={{ minWidth: 0 }}>
                  <Text variant="label-strong-s" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.title}
                  </Text>
                  {muted(f.what)}
                </Column>
              </Row>
              {muted(formatDate(f.at.slice(0, 10)))}
            </Link>
          ))}
        </Column>
      )}
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
