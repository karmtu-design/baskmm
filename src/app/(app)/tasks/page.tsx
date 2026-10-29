import { PageHeader } from "@/components/ui";

const COLUMNS = ["Новые", "В работе", "На проверке", "Готово"];

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Задачи сотрудников"
        subtitle="Доска задач с исполнителями, сроками и привязкой к компаниям и лицензиям появится на следующем этапе."
      />
      <div className="grid gap-4 opacity-70 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {COLUMNS.map((c) => (
          <div key={c} className="min-h-48 rounded-lg border border-dashed border-line bg-surface p-4">
            <div className="text-sm font-medium">{c}</div>
          </div>
        ))}
      </div>
    </>
  );
}
