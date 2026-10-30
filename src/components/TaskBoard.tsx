"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Column, Icon, Row, Text } from "@once-ui-system/core";
import { PRIORITIES, TASK_COLUMNS, daysUntil, formatDate, type Task, type TaskStatus } from "@/lib/types";
import { createTask, deleteTask, moveTask, updateTask, type TaskFields } from "@/app/(app)/tasks/actions";

export type Named = { id: number; name: string };

const dueText = (t: Task) => {
  if (!t.due_date) return null;
  const d = daysUntil(t.due_date)!;
  const late = t.status !== "done" && d < 0;
  const soon = t.status !== "done" && d >= 0 && d <= 3;
  return (
    <span className={`task-due${late ? " is-late" : soon ? " is-soon" : ""}`}>
      <Icon name="calendar" size="xs" /> {formatDate(t.due_date)}
      {late ? `, просрочено на ${-d} дн.` : d === 0 && t.status !== "done" ? ", сегодня" : ""}
    </span>
  );
};

function Card({ t, licenses, projects, onOpen, dragging }: { t: Task; licenses: Map<number, string>; projects: Map<number, string>; onOpen: () => void; dragging?: boolean }) {
  const link = t.license_id ? (
    <Link href={`/licenses/${t.license_id}?tab=tasks`} onClick={(e) => e.stopPropagation()}>
      {licenses.get(t.license_id) ?? "лицензия"}
    </Link>
  ) : t.project_id ? (
    <Link href={`/projects/${t.project_id}`} onClick={(e) => e.stopPropagation()}>
      {projects.get(t.project_id) ?? "проект"}
    </Link>
  ) : null;
  return (
    <div className={`task-card prio-${t.priority}${dragging ? " is-dragging" : ""}${t.status === "done" ? " is-done" : ""}`}>
      <button type="button" className="task-title" onClick={onOpen}>
        {t.title}
      </button>
      <div className="task-meta">
        {t.priority === "high" && <span className="task-prio">важно</span>}
        {t.assignee && (
          <span>
            <Icon name="person" size="xs" /> {t.assignee}
          </span>
        )}
        {dueText(t)}
        {link && <span className="task-link">{link}</span>}
        {t.auto_key && <span className="task-auto">авто</span>}
      </div>
    </div>
  );
}

function SortableCard(props: { t: Task; licenses: Map<number, string>; projects: Map<number, string>; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.t.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      aria-roledescription="Перетаскиваемая задача"
    >
      <Card {...props} />
    </li>
  );
}

function ColumnBox({ id, label, children, count, onAdd }: { id: TaskStatus; label: string; children: React.ReactNode; count: number; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` });
  return (
    <section className={`task-col${isOver ? " is-over" : ""}`} aria-label={label}>
      <header>
        <span>
          {label} <b>{count}</b>
        </span>
        <button type="button" className="nav-close" onClick={onAdd} aria-label={`Добавить задачу в колонку «${label}»`}>
          <Icon name="plus" size="s" />
        </button>
      </header>
      <ul ref={setNodeRef}>{children}</ul>
    </section>
  );
}

export default function TaskBoard({
  tasks,
  licenses,
  projects,
  people,
  fixed,
}: {
  tasks: Task[];
  licenses: Named[];
  projects: Named[];
  people: string[];
  /** on a licence or project page: new tasks are attached to it */
  fixed?: { license_id?: number; project_id?: number };
}) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  useEffect(() => setItems(tasks), [tasks]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ task?: Task; status?: TaskStatus } | null>(null);
  const [who, setWho] = useState("");
  const [hideOld, setHideOld] = useState(true);
  const licMap = useMemo(() => new Map(licenses.map((l) => [l.id, l.name])), [licenses]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const allPeople = useMemo(() => [...new Set([...people, ...(tasks.map((t) => t.assignee).filter(Boolean) as string[])])].sort(), [people, tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const monthAgo = Date.now() - 30 * 86400000;
  const visible = items.filter(
    (t) => (!who || t.assignee === who) && !(hideOld && t.status === "done" && t.completed_at && new Date(t.completed_at).getTime() < monthAgo)
  );
  const col = (s: TaskStatus) => visible.filter((t) => t.status === s).sort((a, b) => a.position - b.position || a.id - b.id);
  const statusOf = (id: string | number): TaskStatus | null => {
    if (typeof id === "string" && id.startsWith("col:")) return id.slice(4) as TaskStatus;
    return items.find((t) => t.id === id)?.status ?? null;
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }
  // moving into another column while dragging, so the card shows where it will land
  function onDragOver(e: DragOverEvent) {
    const to = e.over ? statusOf(e.over.id) : null;
    const from = statusOf(e.active.id);
    if (!to || !from || to === from) return;
    setItems((prev) => prev.map((t) => (t.id === e.active.id ? { ...t, status: to } : t)));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = Number(e.active.id);
    const task = items.find((t) => t.id === id);
    const to = e.over ? statusOf(e.over.id) : null;
    if (!task || !to) return;
    const list = col(to).filter((t) => t.id !== id);
    let index = typeof e.over!.id === "number" ? list.findIndex((t) => t.id === e.over!.id) : list.length;
    if (index < 0) index = list.length;
    const before = list[index - 1]?.position,
      after = list[index]?.position;
    const position = before == null && after == null ? 1 : before == null ? after! - 1 : after == null ? before + 1 : (before + after) / 2;
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: to, position } : t)));
    moveTask(id, to, position).then(() => router.refresh());
  }

  const active = items.find((t) => t.id === activeId);
  return (
    <Column gap="16">
      <Row wrap gap="8" vertical="center">
        <Button prefixIcon="plus" onClick={() => setDialog({ status: "new" })}>
          Новая задача
        </Button>
        <select className="field" aria-label="Исполнитель" style={{ width: "auto", minHeight: 40 }} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Все исполнители</option>
          {allPeople.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={hideOld} onChange={(e) => setHideOld(e.target.checked)} />
          Скрыть выполненные больше месяца назад
        </label>
        <Text variant="body-default-xs" onBackground="neutral-weak" style={{ marginLeft: "auto" }}>
          Перетаскивайте карточки между колонками. На телефоне: нажмите и подержите.
        </Text>
      </Row>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setItems(tasks)}>
        <div className="task-board">
          {TASK_COLUMNS.map((c) => {
            const list = col(c.id);
            return (
              <ColumnBox key={c.id} id={c.id} label={c.label} count={list.length} onAdd={() => setDialog({ status: c.id })}>
                <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {list.map((t) => (
                    <SortableCard key={t.id} t={t} licenses={licMap} projects={projMap} onOpen={() => setDialog({ task: t })} />
                  ))}
                </SortableContext>
                {list.length === 0 && <li className="task-empty">Перетащите сюда задачу</li>}
              </ColumnBox>
            );
          })}
        </div>
        <DragOverlay>{active ? <Card t={active} licenses={licMap} projects={projMap} onOpen={() => {}} dragging /> : null}</DragOverlay>
      </DndContext>
      {dialog && (
        <TaskDialog
          task={dialog.task}
          status={dialog.status}
          licenses={licenses}
          projects={projects}
          people={allPeople}
          fixed={fixed}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </Column>
  );
}

export function TaskDialog({
  task,
  status,
  licenses,
  projects,
  people,
  fixed,
  onClose,
  onSaved,
}: {
  task?: Task;
  status?: TaskStatus;
  licenses: Named[];
  projects: Named[];
  people: string[];
  fixed?: { license_id?: number; project_id?: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<TaskFields>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "normal",
    assignee: task?.assignee ?? "",
    due_date: task?.due_date ?? "",
    license_id: task?.license_id ?? fixed?.license_id ?? null,
    project_id: task?.project_id ?? fixed?.project_id ?? null,
    status: task?.status ?? status ?? "new",
  });
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof TaskFields>(k: K, v: TaskFields[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    start(async () => {
      const r = task ? await updateTask(task.id, f) : await createTask(f);
      if (!r.ok) return setErr(r.message ?? "Ошибка");
      onSaved();
    });
  }
  const link = f.license_id ? `l:${f.license_id}` : f.project_id ? `p:${f.project_id}` : "";

  return (
    <div className="nav-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nav-dialog share-dialog" role="dialog" aria-modal="true" aria-label={task ? "Задача" : "Новая задача"}>
        <div className="nav-head">
          <span>{task ? "Задача" : "Новая задача"}</span>
          <button type="button" className="nav-close" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size="s" />
          </button>
        </div>
        <form
          className="share-body pres-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>
            Что сделать
            <input className="field" required autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="например, подать отчёт по обязательствам" />
          </label>
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>
            Подробности
            <textarea className="field" rows={3} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </label>
          <label className="field-label">
            Исполнитель
            <input className="field" list="task-people" value={f.assignee ?? ""} onChange={(e) => set("assignee", e.target.value)} />
            <datalist id="task-people">
              {people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="field-label">
            Срок
            <input className="field" type="date" value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} />
          </label>
          <label className="field-label">
            Статус
            <select className="field" value={f.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
              {TASK_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Важность
            <select className="field" value={f.priority} onChange={(e) => set("priority", e.target.value as Task["priority"])}>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {!fixed && (
            <label className="field-label" style={{ gridColumn: "1 / -1" }}>
              Относится к
              <select
                className="field"
                value={link}
                onChange={(e) => {
                  const [k, id] = e.target.value.split(":");
                  setF((p) => ({ ...p, license_id: k === "l" ? Number(id) : null, project_id: k === "p" ? Number(id) : null }));
                }}
              >
                <option value="">— ни к чему не привязана</option>
                <optgroup label="Лицензии">
                  {licenses.map((l) => (
                    <option key={l.id} value={`l:${l.id}`}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Потенциальные проекты">
                  {projects.map((p) => (
                    <option key={p.id} value={`p:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}
          <Row gap="8" wrap style={{ gridColumn: "1 / -1" }}>
            <Button type="submit" loading={pending}>
              {task ? "Сохранить" : "Создать задачу"}
            </Button>
            <Button type="button" variant="tertiary" onClick={onClose}>
              Отмена
            </Button>
            {task && (
              <span style={{ marginLeft: "auto" }}>
                {ask ? (
                  <Row gap="4">
                    <Button
                      type="button"
                      variant="danger"
                      loading={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteTask(task.id);
                          if (!r.ok) return setErr(r.message ?? "Ошибка");
                          onSaved();
                        })
                      }
                    >
                      {task.auto_key ? "Закрыть задачу" : "Удалить задачу"}
                    </Button>
                    <Button type="button" variant="tertiary" onClick={() => setAsk(false)}>
                      Нет
                    </Button>
                  </Row>
                ) : (
                  <Button type="button" variant="tertiary" prefixIcon="trash" onClick={() => setAsk(true)}>
                    Удалить
                  </Button>
                )}
              </span>
            )}
          </Row>
          {task && (
            <Text variant="body-default-xs" onBackground="neutral-weak" style={{ gridColumn: "1 / -1" }}>
              Создал {task.created_by ?? "—"} {new Date(task.created_at).toLocaleDateString("ru-RU")}
              {task.auto_key ? ". Задача создана системой: при удалении она закрывается, чтобы не появиться снова." : ""}
            </Text>
          )}
          {err && (
            <Text variant="body-default-s" onBackground="danger-strong" role="alert" style={{ gridColumn: "1 / -1" }}>
              {err}
            </Text>
          )}
        </form>
      </div>
    </div>
  );
}
