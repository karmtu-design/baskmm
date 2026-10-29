"use client";

import { ViewTransition, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@once-ui-system/core";
import DataTable, { type DataColumn } from "./DataTable";
import { ExpiryText, MineralSwatch, StatusBadge } from "./ui";
import { downloadLicenseWorkbook } from "@/lib/excel";
import { STATUSES, daysUntil, formatDate, type Company, type License } from "@/lib/types";

const muted = { fontSize: 12, color: "var(--neutral-on-background-weak)" } as const;

const columns: DataColumn<License>[] = [
  {
    id: "deposit",
    accessorFn: (l) => `${l.deposit_name ?? ""} ${l.license_number}`,
    header: "Участок",
    meta: { label: "Участок", hideable: false },
    sortFn: "text",
    cell: ({ row }) => (
      <>
        <Link href={`/licenses/${row.original.id}`}>
          <ViewTransition name={`lic-title-${row.original.id}`} share="morph" default="none">
            <span style={{ display: "inline-block" }}>{row.original.deposit_name || "Без названия"}</span>
          </ViewTransition>
        </Link>
        <div style={muted}>{row.original.license_number}</div>
      </>
    ),
  },
  { id: "company", accessorKey: "company_name", header: "Компания", meta: { label: "Компания" }, sortFn: "text" },
  {
    id: "type",
    accessorFn: (l) => `${l.license_type ?? ""}${l.category ? `, ${l.category}` : ""}`,
    header: "Вид",
    meta: { label: "Вид и категория" },
  },
  {
    id: "mineral",
    accessorFn: (l) => l.mineral ?? "",
    header: "Полезное ископаемое",
    meta: { label: "Полезное ископаемое" },
    cell: ({ row }) => <MineralSwatch mineral={row.original.mineral} />,
  },
  {
    id: "place",
    accessorFn: (l) => [l.region, l.district].filter(Boolean).join(", "),
    header: "Расположение",
    meta: { label: "Расположение" },
  },
  {
    id: "issue",
    accessorFn: (l) => (l.issue_date ? new Date(l.issue_date) : undefined),
    header: "Выдана",
    meta: { label: "Дата выдачи" },
    sortFn: "datetime",
    sortUndefined: "last",
    cell: ({ row }) => formatDate(row.original.issue_date),
  },
  {
    id: "expiry",
    accessorFn: (l) => (l.expiry_date ? new Date(l.expiry_date) : undefined),
    header: "Действует до",
    meta: { label: "Действует до" },
    sortFn: "datetime",
    sortUndefined: "last",
    cell: ({ row }) => <ExpiryText date={row.original.expiry_date} />,
  },
  {
    id: "area",
    accessorFn: (l) => l.area_sq_km ?? undefined,
    header: "Площадь, км²",
    meta: { label: "Площадь" },
    sortUndefined: "last",
    cell: ({ row }) => row.original.area_sq_km ?? "—",
  },
  { id: "status", accessorFn: (l) => l.status ?? "", header: "Статус", meta: { label: "Статус" }, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { id: "responsible", accessorFn: (l) => l.responsible ?? "", header: "Ответственный", meta: { label: "Ответственный" } },
  {
    id: "contour",
    accessorFn: (l) => (l.contour ? "есть" : "нет"),
    header: "Контур",
    meta: { label: "Контур на карте" },
    cell: ({ row }) =>
      row.original.contour ? "есть" : <span style={{ color: "var(--warning-on-background-strong)" }}>нет</span>,
  },
];

export default function LicenseRegister({ licenses, companies }: { licenses: License[]; companies: Company[] }) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [soon, setSoon] = useState(false);
  const [exporting, setExporting] = useState(false);
  const visibleRows = useRef<License[]>([]);

  const data = useMemo(
    () =>
      licenses.filter((l) => {
        const d = daysUntil(l.expiry_date);
        return (
          (!company || String(l.company_id) === company) &&
          (!type || l.license_type === type) &&
          (!status || l.status === status) &&
          (!soon || (d != null && d <= 365))
        );
      }),
    [licenses, company, type, status, soon]
  );

  async function exportExcel() {
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await downloadLicenseWorkbook(visibleRows.current, `BASK лицензии ${date}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  const sel = { width: "auto", minHeight: 40 } as const;
  return (
    <DataTable
      data={data}
      columns={columns}
      search={search}
      rowsRef={visibleRows}
      initialSorting={[{ id: "expiry", desc: false }]}
      initialHidden={{ responsible: false, issue: false }}
      toolbar={
        <>
          <input
            type="search"
            className="field"
            placeholder="Поиск: участок, номер, металл, район…"
            aria-label="Поиск по лицензиям"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, minHeight: 40 }}
          />
          <select aria-label="Компания" className="field" style={sel} value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">Все компании</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select aria-label="Вид лицензии" className="field" style={sel} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Разведка и добыча</option>
            <option value="Разведка">Разведка</option>
            <option value="Добыча">Добыча</option>
          </select>
          <select aria-label="Статус" className="field" style={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Любой статус</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={soon} onChange={(e) => setSoon(e.target.checked)} />
            Истекают в течение года
          </label>
          <span style={{ marginLeft: "auto" }} />
          <Button variant="secondary" size="s" prefixIcon="download" onClick={exportExcel} loading={exporting}>
            Выгрузить в Excel
          </Button>
        </>
      }
    />
  );
}
