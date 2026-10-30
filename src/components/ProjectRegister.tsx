"use client";

import { tr, loc } from "@/i18n";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Tag } from "@once-ui-system/core";
import DataTable, { type DataColumn } from "./DataTable";
import { MineralSwatch } from "./ui";
import { downloadProjectWorkbook } from "@/lib/projectsExcel";
import { PROJECT_STAGES, daysUntil, formatDate, type PotentialProject } from "@/lib/types";

const muted = { fontSize: 12, color: "var(--neutral-on-background-weak)" } as const;

export function StageBadge({ stage }: { stage: string | null }) {
  const s = stage || "—";
  const scheme =
    s === "Сделка" ? "success" : s === "Отклонён" ? "danger" : s === "Отложен" ? "neutral" : s === "Новый" ? "info" : "warning";
  return <Tag as="span" size="s" scheme={scheme} label={tr(s)} />;
}

function NextDate({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d == null) return <span>—</span>;
  const color = d < 0 ? "var(--danger-on-background-strong)" : d <= 7 ? "var(--warning-on-background-strong)" : undefined;
  return (
    <span style={{ color }}>
      {formatDate(date)}
      {d < 0 && <span style={{ display: "block", fontSize: 12 }}>{tr("просрочено на")}{" "}{-d}{" "}{tr("дн.")}</span>}
    </span>
  );
}

// built during rendering, so headers and cells come out in the interface language
function makeColumns(): DataColumn<PotentialProject>[] {
  return [
  {
    id: "name",
    accessorFn: (p) => `${p.name} ${p.holder ?? ""}`,
    header: tr("Проект"),
    meta: { label: tr("Проект"), hideable: false },
    sortFn: "text",
    cell: ({ row }) => (
      <>
        <Link href={`/projects/${row.original.id}`}>{row.original.name}</Link>
        {row.original.holder && <div style={muted}>{row.original.holder}</div>}
      </>
    ),
  },
  {
    id: "commodity",
    accessorFn: (p) => p.commodity ?? "",
    header: tr("Полезное ископаемое"),
    meta: { label: tr("Полезное ископаемое") },
    cell: ({ row }) => <MineralSwatch mineral={row.original.commodity} />,
  },
  {
    id: "place",
    accessorFn: (p) => [p.region, p.district].filter(Boolean).join(", "),
    header: tr("Расположение"),
    meta: { label: tr("Расположение") },
  },
  {
    id: "stage",
    accessorFn: (p) => PROJECT_STAGES.indexOf(p.stage ?? "") + 1 || 99,
    header: tr("Этап"),
    meta: { label: tr("Этап") },
    cell: ({ row }) => <StageBadge stage={row.original.stage} />,
  },
  { id: "deal", accessorFn: (p) => (p.deal_type ? tr(p.deal_type) : ""), header: tr("Тип сделки"), meta: { label: tr("Тип сделки") } },
  { id: "resources", accessorFn: (p) => p.resources ?? "", header: tr("Запасы / ресурсы"), meta: { label: tr("Запасы / ресурсы") } },
  { id: "terms", accessorFn: (p) => p.terms ?? "", header: tr("Условия"), meta: { label: tr("Условия / цена") } },
  {
    id: "next",
    accessorFn: (p) => p.next_step ?? "",
    header: tr("Следующий шаг"),
    meta: { label: tr("Следующий шаг") },
    cell: ({ row }) => (
      <>
        {row.original.next_step || "—"}
        {row.original.next_date && (
          <div style={muted}>
            <NextDate date={row.original.next_date} />
          </div>
        )}
      </>
    ),
  },
  {
    id: "next_date",
    accessorFn: (p) => (p.next_date ? new Date(p.next_date) : undefined),
    header: tr("Срок"),
    meta: { label: tr("Срок следующего шага") },
    sortFn: "datetime",
    sortUndefined: "last",
    cell: ({ row }) => <NextDate date={row.original.next_date} />,
  },
  { id: "responsible", accessorFn: (p) => p.responsible ?? "", header: tr("Ответственный"), meta: { label: tr("Ответственный") } },
  { id: "source", accessorFn: (p) => p.source ?? "", header: tr("Источник"), meta: { label: tr("Откуда пришёл") } },
  { id: "contact", accessorFn: (p) => p.contact ?? "", header: tr("Контакт"), meta: { label: tr("Контакт") } },
  {
    id: "updated",
    accessorFn: (p) => new Date(p.updated_at),
    header: tr("Обновлён"),
    meta: { label: tr("Дата изменения") },
    sortFn: "datetime",
    cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(loc()),
  },
  ];
}

export default function ProjectRegister({ projects, initialStage = "" }: { projects: PotentialProject[]; initialStage?: string }) {
  const columns = useMemo(() => makeColumns(), []);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState(initialStage);
  const [hideClosed, setHideClosed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const visible = useRef<PotentialProject[]>([]);

  const data = useMemo(
    () => projects.filter((p) => (!stage || p.stage === stage) && (!hideClosed || (p.stage !== "Отклонён" && p.stage !== "Отложен"))),
    [projects, stage, hideClosed]
  );

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadProjectWorkbook(visible.current, `BASK потенциальные проекты ${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <DataTable
      data={data}
      columns={columns}
      search={search}
      rowsRef={visible}
      initialSorting={[{ id: "stage", desc: false }]}
      initialHidden={{ next_date: false, responsible: false, source: false, contact: false, terms: false, updated: false }}
      emptyText={projects.length ? tr("Ничего не найдено. Измените условия поиска.") : tr("Проектов пока нет. Добавьте первый или загрузите список из Excel.")}
      toolbar={
        <>
          <input
            type="search"
            className="field"
            placeholder={tr("Поиск: проект, металл, владелец, район…")}
            aria-label={tr("Поиск по проектам")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, minHeight: 40 }}
          />
          <select aria-label={tr("Этап")} className="field" style={{ width: "auto", minHeight: 40 }} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">{tr("Все этапы")}</option>
            {PROJECT_STAGES.map((s) => (
              <option key={s} value={s}>{tr(s)}</option>
            ))}
          </select>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />{tr("Скрыть отложенные и отклонённые")}</label>
          <span style={{ marginLeft: "auto" }} />
          <Button variant="secondary" size="s" prefixIcon="download" onClick={exportExcel} loading={exporting}>{tr("Выгрузить в Excel")}</Button>
        </>
      }
    />
  );
}
