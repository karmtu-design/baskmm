import { pageTitle } from "@/i18n/meta";
import { tr, loc } from "@/i18n";
import { dn, dp } from "@/lib/translit";
import { Column, Grid, Text } from "@once-ui-system/core";
import { BarCard, ColumnCard, PriceCard } from "@/components/StatsCharts";
import { PageHeader } from "@/components/ui";
import { getDocuments, getLicenses, getMetalHistory, getProjects, getTasks } from "@/lib/data";
import { METALS } from "@/lib/metals";
import { PROJECT_STAGES, daysUntil, mineralGroup } from "@/lib/types";

export const generateMetadata = pageTitle("Аналитика");

const count = <T,>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

function Tile({ value, label, tone }: { value: string; label: string; tone?: "warn" | "bad" }) {
  return (
    <Column background="surface" border radius="l" padding="16" gap="4">
      <Text variant="display-strong-xs" className={tone ? `tile-${tone}` : undefined}>
        {value}
      </Text>
      <Text variant="body-default-s" onBackground="neutral-weak">
        {label}
      </Text>
    </Column>
  );
}

export default async function StatsPage() {
  const [licenses, projects, tasks, docs, history] = await Promise.all([getLicenses(), getProjects(), getTasks(), getDocuments(), getMetalHistory()]);
  const nowYear = new Date().getFullYear();
  const totalArea = licenses.reduce((s, l) => s + (l.area_sq_km ?? 0), 0);
  const soon = licenses.filter((l) => {
    const d = daysUntil(l.expiry_date);
    return d != null && d >= 0 && d <= 365;
  }).length;
  const expired = licenses.filter((l) => (daysUntil(l.expiry_date) ?? 1) < 0).length;
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => (daysUntil(t.due_date) ?? 1) < 0).length;
  const activeProjects = projects.filter((p) => p.stage !== "Отложен" && p.stage !== "Отклонён").length;

  const area = new Map<string, number>();
  for (const l of licenses) area.set(dn(l.company_name), (area.get(dn(l.company_name)) ?? 0) + (l.area_sq_km ?? 0));
  const areaByCompany = [...area].map(([label, value]) => ({ label, value })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

  const years = Array.from({ length: 10 }, (_, i) => String(nowYear + i));
  const byYear = [
    { label: tr("Истекли"), value: expired },
    ...years.map((y) => ({ label: y, value: licenses.filter((l) => l.expiry_date?.startsWith(y) && (daysUntil(l.expiry_date) ?? -1) >= 0).length })),
    { label: tr("Позже"), value: licenses.filter((l) => l.expiry_date && Number(l.expiry_date.slice(0, 4)) > nowYear + 9).length },
  ];
  const stages = PROJECT_STAGES.map((s) => ({ label: tr(s), value: projects.filter((p) => p.stage === s).length }));

  return (
    <Column gap="24">
      <PageHeader title={tr("Аналитика")} subtitle={tr("Портфель в цифрах и графиках. Наведите на столбик, чтобы увидеть значение; под каждым графиком те же данные таблицей.")} />
      <Grid columns="6" gap="12" m={{ columns: "3" }} s={{ columns: "2" }}>
        <Tile value={String(licenses.length)} label={tr("лицензий")} />
        <Tile value={tr("{0} км²", { 0: Math.round(totalArea).toLocaleString(loc()) })} label={tr("площадь по лицензиям")} />
        <Tile value={String(soon)} label={tr("истекают в течение года")} tone={soon ? "warn" : undefined} />
        <Tile value={String(activeProjects)} label={tr("проектов в работе")} />
        <Tile value={String(open.length)} label={overdue ? tr("открытых задач, просрочено {0}", { 0: overdue }) : tr("открытых задач")} tone={overdue ? "bad" : undefined} />
        <Tile value={String(docs.length)} label={tr("документов")} />
      </Grid>
      <Grid columns="2" gap="16" m={{ columns: "1" }}>
        <BarCard title={tr("Лицензии по полезным ископаемым")} data={count(licenses, (l) => tr(mineralGroup(l.mineral)))} head={[tr("Группа"), tr("Лицензий")]} />
        <BarCard title={tr("Площадь по компаниям")} note={tr("По площади, указанной в лицензии.")} data={areaByCompany} unit={tr("км²")} digits={1} head={[tr("Компания"), tr("Площадь")]} />
        <ColumnCard title={tr("Окончание сроков лицензий по годам")} note={tr("Оранжевым — лицензии, срок которых уже истёк.")} data={byYear} highlight={tr("Истекли")} head={[tr("Год"), tr("Лицензий")]} />
        <BarCard title={tr("Лицензии по областям")} data={count(licenses, (l) => dp(l.region) || tr("Не указана"))} head={[tr("Область"), tr("Лицензий")]} />
        <BarCard title={tr("Потенциальные проекты по этапам")} note={tr("В порядке этапов: от нового до сделки.")} data={stages} head={[tr("Этап"), tr("Проектов")]} />
        <PriceCard
          history={history.map((h) => ({ metal: h.metal, date: h.price_date, price: h.price }))}
          metals={METALS.map((m) => ({ key: m.key, name: tr(m.name), unit: tr(m.unit) }))}
        />
      </Grid>
    </Column>
  );
}
