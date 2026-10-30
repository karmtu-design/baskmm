"use client";

import { tr, currentLocale } from "@/i18n";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";
import zhLocale from "@fullcalendar/core/locales/zh-cn";
import type { EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import { Row } from "@once-ui-system/core";
import { TaskDialog, type Named } from "./TaskBoard";
import { updateTask } from "@/app/(app)/tasks/actions";
import type { Task } from "@/lib/types";

type Dated = { id: number; name: string; date: string; note?: string };

/** One calendar for everything with a date: tasks, licence expiry dates and next steps on projects. */
export default function TaskCalendar({
  tasks,
  expiries,
  steps,
  licenses,
  projects,
  people,
}: {
  tasks: Task[];
  expiries: Dated[];
  steps: Dated[];
  licenses: Named[];
  projects: Named[];
  people: string[];
}) {
  const router = useRouter();
  const lang = currentLocale();
  const [open, setOpen] = useState<Task | null>(null);
  const [show, setShow] = useState({ tasks: true, expiries: true, steps: true });

  const events = useMemo<EventInput[]>(() => {
    const out: EventInput[] = [];
    if (show.tasks)
      for (const t of tasks)
        if (t.due_date)
          out.push({
            id: `t${t.id}`,
            title: t.title,
            start: t.due_date,
            allDay: true,
            classNames: ["ev-task", `ev-${t.priority}`, t.status === "done" ? "ev-done" : ""],
            editable: t.status !== "done",
            extendedProps: { kind: "task", id: t.id },
          });
    if (show.expiries)
      for (const e of expiries)
        out.push({ id: `e${e.id}`, title: tr("Истекает лицензия: {0}", { 0: e.name }), start: e.date, allDay: true, classNames: ["ev-expiry"], editable: false, extendedProps: { kind: "license", id: e.id } });
    if (show.steps)
      for (const s of steps)
        out.push({ id: `p${s.id}`, title: tr("{0}: {1}", { 0: s.name, 1: s.note ?? tr("следующий шаг") }), start: s.date, allDay: true, classNames: ["ev-step"], editable: false, extendedProps: { kind: "project", id: s.id } });
    return out;
  }, [tasks, expiries, steps, show]);

  function onClick(a: EventClickArg) {
    const { kind, id } = a.event.extendedProps as { kind: string; id: number };
    if (kind === "task") setOpen(tasks.find((t) => t.id === id) ?? null);
    if (kind === "license") router.push(`/licenses/${id}`);
    if (kind === "project") router.push(`/projects/${id}`);
  }
  // dragging a task to another day moves its deadline
  async function onDrop(a: EventDropArg) {
    const t = tasks.find((x) => x.id === (a.event.extendedProps as { id: number }).id);
    const d = a.event.start;
    if (!t || !d) return a.revert();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const r = await updateTask(t.id, { ...t, due_date: iso });
    if (!r.ok) a.revert();
    else router.refresh();
  }

  const toggle = (k: keyof typeof show, label: string, cls: string) => (
    <label className="cal-legend">
      <input type="checkbox" checked={show[k]} onChange={() => setShow((s) => ({ ...s, [k]: !s[k] }))} />
      <span className={`cal-dot ${cls}`} aria-hidden /> {label}
    </label>
  );

  return (
    <div className="cal-shell">
      <Row wrap gap="16" vertical="center" marginBottom="12">
        {toggle("tasks", tr("Задачи"), "ev-task")}
        {toggle("expiries", tr("Окончание лицензий"), "ev-expiry")}
        {toggle("steps", tr("Шаги по проектам"), "ev-step")}
      </Row>
      <FullCalendar
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={lang === "ru" ? ruLocale : lang === "zh" ? zhLocale : "en-gb"}
        firstDay={1}
        height="auto"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,listMonth" }}
        buttonText={{ today: tr("Сегодня"), month: tr("Месяц"), list: tr("Список") }}
        events={events}
        eventClick={onClick}
        eventDrop={onDrop}
        dayMaxEvents={4}
        noEventsText={tr("В этом месяце нет сроков")}
      />
      {open && (
        <TaskDialog
          task={open}
          licenses={licenses}
          projects={projects}
          people={people}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
