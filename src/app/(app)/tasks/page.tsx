import dynamic from "next/dynamic";
import Link from "next/link";
import { Column, Row } from "@once-ui-system/core";
import TaskBoard from "@/components/TaskBoard";
import { PageHeader } from "@/components/ui";
import { getLicenses, getProjects, getTasks } from "@/lib/data";

export const metadata = { title: "Задачи и сроки" };

const TaskCalendar = dynamic(() => import("@/components/TaskCalendar"), { loading: () => <p className="muted">Загружается календарь…</p> });
const LicenseGantt = dynamic(() => import("@/components/LicenseGantt"), { loading: () => <p className="muted">Загружается диаграмма…</p> });

const VIEWS = [
  { id: "board", label: "Доска задач" },
  { id: "calendar", label: "Календарь сроков" },
  { id: "gantt", label: "Сроки лицензий" },
] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: v } = await searchParams;
  const view = VIEWS.some((x) => x.id === v) ? v! : "board";
  const [tasks, licenses, projects] = await Promise.all([getTasks(), getLicenses(), getProjects()]);
  const lic = licenses.map((l) => ({ id: l.id, name: l.deposit_name || l.license_number }));
  const proj = projects.map((p) => ({ id: p.id, name: p.name }));
  const people = [...new Set([...licenses.map((l) => l.responsible), ...projects.map((p) => p.responsible)].filter(Boolean) as string[])];

  return (
    <Column>
      <PageHeader
        title="Задачи и сроки"
        subtitle="Задачи сотрудников, календарь всех сроков и диаграмма сроков лицензий. За 90 дней до окончания лицензии задача на продление появляется сама."
      />
      <Row as="nav" gap="4" marginBottom="24" borderBottom overflowX="auto" aria-label="Вид" className="tab-row">
        {VIEWS.map((x) => (
          <Link key={x.id} href={`/tasks?view=${x.id}`} aria-current={view === x.id ? "page" : undefined} className="tab-link">
            {x.label}
          </Link>
        ))}
      </Row>
      {view === "board" && <TaskBoard tasks={tasks} licenses={lic} projects={proj} people={people} />}
      {view === "calendar" && (
        <TaskCalendar
          tasks={tasks}
          licenses={lic}
          projects={proj}
          people={people}
          expiries={licenses.filter((l) => l.expiry_date).map((l) => ({ id: l.id, name: l.deposit_name || l.license_number, date: l.expiry_date! }))}
          steps={projects.filter((p) => p.next_date).map((p) => ({ id: p.id, name: p.name, date: p.next_date!, note: p.next_step ?? undefined }))}
        />
      )}
      {view === "gantt" && (
        <LicenseGantt
          licenses={licenses
            .filter((l) => l.issue_date && l.expiry_date)
            .sort((a, b) => a.expiry_date!.localeCompare(b.expiry_date!))
            .map((l) => ({ id: l.id, name: l.deposit_name || l.license_number, number: l.license_number, company: l.company_name, start: l.issue_date!, end: l.expiry_date!, status: l.status, type: l.license_type }))}
        />
      )}
    </Column>
  );
}
