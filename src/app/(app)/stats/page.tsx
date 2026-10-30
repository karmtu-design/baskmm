import { Column, Grid, Text } from "@once-ui-system/core";
import { BarCard, ColumnCard, PriceCard } from "@/components/StatsCharts";
import { PageHeader } from "@/components/ui";
import { getDocuments, getLicenses, getMetalHistory, getProjects, getTasks } from "@/lib/data";
import { METALS } from "@/lib/metals";
import { PROJECT_STAGES, daysUntil, mineralGroup } from "@/lib/types";

export const metadata = { title: "Аналитика" };

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
  for (const l of licenses) area.set(l.company_name, (area.get(l.company_name) ?? 0) + (l.area_sq_km ?? 0));
  const areaByCompany = [...area].map(([label, value]) => ({ label, value })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

  const years = Array.from({ length: 10 }, (_, i) => String(nowYear + i));
  const byYear = [
    { label: "Истекли", value: expired },
    ...years.map((y) => ({ label: y, value: licenses.filter((l) => l.expiry_date?.startsWith(y) && (daysUntil(l.expiry_date) ?? -1) >= 0).length })),
    { label: "Позже", value: licenses.filter((l) => l.expiry_date && Number(l.expiry_date.slice(0, 4)) > nowYear + 9).length },
  ];
  const stages = PROJECT_STAGES.map((s) => ({ label: s, value: projects.filter((p) => p.stage === s).length }));

  return (
    <Column gap="24">
      <PageHeader title="Аналитика" subtitle="Портфель в цифрах и графиках. Наведите на столбик, чтобы увидеть значение; под каждым графиком те же данные таблицей." />
      <Grid columns="6" gap="12" m={{ columns: "3" }} s={{ columns: "2" }}>
        <Tile value={String(licenses.length)} label="лицензий" />
        <Tile value={`${Math.round(totalArea).toLocaleString("ru-RU")} км²`} label="площадь по лицензиям" />
        <Tile value={String(soon)} label="истекают в течение года" tone={soon ? "warn" : undefined} />
        <Tile value={String(activeProjects)} label="проектов в работе" />
        <Tile value={String(open.length)} label={overdue ? `открытых задач, просрочено ${overdue}` : "открытых задач"} tone={overdue ? "bad" : undefined} />
        <Tile value={String(docs.length)} label="документов" />
      </Grid>
      <Grid columns="2" gap="16" m={{ columns: "1" }}>
        <BarCard title="Лицензии по полезным ископаемым" data={count(licenses, (l) => mineralGroup(l.mineral))} head={["Группа", "Лицензий"]} />
        <BarCard title="Площадь по компаниям" note="По площади, указанной в лицензии." data={areaByCompany} unit="км²" digits={1} head={["Компания", "Площадь"]} />
        <ColumnCard title="Окончание сроков лицензий по годам" note="Оранжевым — лицензии, срок которых уже истёк." data={byYear} highlight="Истекли" head={["Год", "Лицензий"]} />
        <BarCard title="Лицензии по областям" data={count(licenses, (l) => l.region || "Не указана")} head={["Область", "Лицензий"]} />
        <BarCard title="Потенциальные проекты по этапам" note="В порядке этапов: от нового до сделки." data={stages} head={["Этап", "Проектов"]} />
        <PriceCard
          history={history.map((h) => ({ metal: h.metal, date: h.price_date, price: h.price }))}
          metals={METALS.map((m) => ({ key: m.key, name: m.name, unit: m.unit }))}
        />
      </Grid>
    </Column>
  );
}
