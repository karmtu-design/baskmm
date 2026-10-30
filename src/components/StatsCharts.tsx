"use client";

import { tr, loc } from "@/i18n";

import { useCallback, useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { Column, Heading, Text } from "@once-ui-system/core";
import EChart, { type ChartTheme } from "./EChart";

export type Pair = { label: string; value: number };
export type PricePoint = { metal: string; date: string; price: number };
export type MetalInfo = { key: string; name: string; unit: string };

const nf = (d = 0) => (v: number) => v.toLocaleString(loc(), { maximumFractionDigits: d });
const compact = (v: number) => (Math.abs(v) >= 1000 ? tr("{0} тыс.", { 0: (v / 1000).toLocaleString(loc(), { maximumFractionDigits: 1 }) }) : v.toLocaleString(loc()));
// category names come from the database: escaped before they go into tooltip HTML
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function tip(t: ChartTheme) {
  return {
    backgroundColor: t.surface,
    borderColor: t.grid,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: t.text, fontFamily: t.font, fontSize: 12 },
    extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25)",
  };
}

function hbar(data: Pair[], fmt: (v: number) => string, integer: boolean) {
  return (t: ChartTheme): EChartsCoreOption => ({
    animationDuration: 400,
    textStyle: { fontFamily: t.font, color: t.text },
    grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: "value", minInterval: integer ? 1 : undefined, splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.muted, formatter: compact }, axisLine: { show: false } },
    yAxis: {
      type: "category",
      data: data.map((d) => d.label),
      inverse: true,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.grid } },
      axisLabel: { color: t.text, width: 150, overflow: "truncate", fontSize: 12 },
    },
    tooltip: { trigger: "item", ...tip(t), formatter: (p: { name: string; value: number }) => `<b>${fmt(p.value)}</b><br/><span style="opacity:.75">${esc(p.name)}</span>` },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.value),
        barMaxWidth: 20,
        itemStyle: { color: t.series, borderRadius: [0, 4, 4, 0] },
        emphasis: { itemStyle: { opacity: 0.85 } },
        label: { show: true, position: "right", color: t.text, fontSize: 12, formatter: (p: { value: number }) => fmt(p.value) },
      },
    ],
  });
}

function columns(data: Pair[], highlight?: string) {
  return (t: ChartTheme, width: number): EChartsCoreOption => ({
    animationDuration: 400,
    textStyle: { fontFamily: t.font, color: t.text },
    grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
    xAxis: { type: "category", data: data.map((d) => d.label), axisTick: { show: false }, axisLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.text, fontSize: 11, interval: 0, rotate: width < 560 ? 45 : 0 } },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.muted } },
    tooltip: {
      trigger: "item",
      ...tip(t),
      formatter: (p: { name: string; value: number }) => tr("<b>{0} {1}</b><br/><span style=\"opacity:.75\">{2}</span>", { 0: p.value, 1: tr(p.value === 1 ? "лицензия" : p.value < 5 && p.value > 1 ? "лицензии" : "лицензий"), 2: esc(p.name) }),
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => ({ value: d.value, itemStyle: d.label === highlight ? { color: "#d95926" } : undefined })),
        barMaxWidth: 24,
        itemStyle: { color: t.series, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { opacity: 0.85 } },
        label: { show: true, position: "top", color: t.text, fontSize: 12, formatter: (p: { value: number }) => (p.value ? String(p.value) : "") },
      },
    ],
  });
}

function TableView({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <details className="chart-table">
      <summary>{tr("Показать таблицей")}</summary>
      <div className="data-table-wrap" style={{ marginTop: 8 }}>
        <table className="data-table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>{head[0]}</th>
              <th style={{ textAlign: "right" }}>{head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, b]) => (
              <tr key={a}>
                <td>{a}</td>
                <td style={{ textAlign: "right" }}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Column background="surface" border radius="l" padding="20" gap="12" className="chart-card">
      <Column gap="4">
        <Heading as="h2" variant="heading-strong-s">
          {title}
        </Heading>
        {note && (
          <Text variant="body-default-xs" onBackground="neutral-weak">
            {note}
          </Text>
        )}
      </Column>
      {children}
    </Column>
  );
}

export function BarCard({ title, note, data, unit, digits = 0, head }: { title: string; note?: string; data: Pair[]; unit?: string; digits?: number; head: [string, string] }) {
  const fmt = useCallback((v: number) => `${nf(digits)(v)}${unit ? ` ${unit}` : ""}`, [digits, unit]);
  const option = useMemo(() => hbar(data, fmt, digits === 0 && !unit), [data, fmt, digits, unit]);
  return (
    <Card title={title} note={note}>
      {data.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Нет данных.")}</Text>
      ) : (
        <>
          <EChart option={option} height={Math.max(140, data.length * 36 + 24)} label={`${title}: ${data.map((d) => `${d.label} ${fmt(d.value)}`).join(", ")}`} />
          <TableView head={head} rows={data.map((d) => [d.label, fmt(d.value)])} />
        </>
      )}
    </Card>
  );
}

export function ColumnCard({ title, note, data, highlight, head }: { title: string; note?: string; data: Pair[]; highlight?: string; head: [string, string] }) {
  const option = useMemo(() => columns(data, highlight), [data, highlight]);
  return (
    <Card title={title} note={note}>
      <EChart option={option} height={260} label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`} />
      <TableView head={head} rows={data.map((d) => [d.label, String(d.value)])} />
    </Card>
  );
}

/** Price history of one metal at a time: metals differ in scale, so they never share an axis. */
export function PriceCard({ history, metals }: { history: PricePoint[]; metals: MetalInfo[] }) {
  const available = metals.filter((m) => history.some((h) => h.metal === m.key));
  const [key, setKey] = useState(available.find((m) => m.key === "copper")?.key ?? available[0]?.key ?? "");
  const m = metals.find((x) => x.key === key);
  const pts = useMemo(() => history.filter((h) => h.metal === key), [history, key]);
  const fmt = useCallback((v: number) => v.toLocaleString(loc(), { maximumFractionDigits: m?.key === "gold" || m?.key === "silver" ? 2 : 0 }), [m]);
  const dd = (iso: string) => iso.split("-").reverse().slice(0, 2).join(".");

  const option = useMemo(
    () =>
      (t: ChartTheme): EChartsCoreOption => ({
        animationDuration: 400,
        textStyle: { fontFamily: t.font, color: t.text },
        grid: { left: 8, right: 72, top: 16, bottom: 4, containLabel: true },
        xAxis: { type: "category", boundaryGap: false, data: pts.map((p) => dd(p.date)), axisTick: { show: false }, axisLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.muted, fontSize: 11 } },
        yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.muted, formatter: compact } },
        tooltip: {
          trigger: "axis",
          ...tip(t),
          axisPointer: { type: "line", lineStyle: { color: t.muted, width: 1 } },
          formatter: (ps: { dataIndex: number; value: number }[]) => {
            const p = ps[0];
            return `<b>${fmt(p.value)} ${m?.unit ?? ""}</b><br/><span style="opacity:.75">${esc(m?.name ?? "")}, ${pts[p.dataIndex].date.split("-").reverse().join(".")}</span>`;
          },
        },
        series: [
          {
            type: "line",
            data: pts.map((p) => p.price),
            smooth: false,
            symbol: "circle",
            symbolSize: 8,
            showSymbol: pts.length < 3,
            lineStyle: { width: 2, color: t.series, cap: "round", join: "round" },
            itemStyle: { color: t.series, borderColor: t.surface, borderWidth: 2 },
            areaStyle: { color: t.wash },
            endLabel: { show: true, color: t.text, fontSize: 12, formatter: (p: { value: number }) => fmt(p.value) },
          },
        ],
      }),
    [pts, fmt, m]
  );

  return (
    <Card title={tr("История цен на металлы")} note={tr("Цены записываются каждый рабочий день с момента подключения; график растёт сам. Каждый металл на своём графике: у них разный масштаб.")}>
      {available.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Цены ещё не записывались.")}</Text>
      ) : (
        <>
          <div className="chip-row" role="tablist" aria-label={tr("Металл")}>
            {available.map((x) => (
              <button key={x.key} type="button" role="tab" aria-selected={x.key === key} className={`chip${x.key === key ? " is-on" : ""}`} onClick={() => setKey(x.key)}>
                {x.name}
              </button>
            ))}
          </div>
          {pts.length < 2 ? (
            <Text variant="body-default-s" onBackground="neutral-weak">
              {tr("Пока записана одна цена ({0} {1} на {2}). Линия появится со следующего рабочего дня.", { 0: fmt(pts[0]?.price ?? 0), 1: m?.unit, 2: pts[0]?.date.split("-").reverse().join(".") })}
            </Text>
          ) : (
            <EChart option={option} height={260} label={tr("Цена: {0}, от {1} до {2} {3}", { 0: m?.name, 1: fmt(pts[0].price), 2: fmt(pts[pts.length - 1].price), 3: m?.unit })} />
          )}
          <TableView head={[tr("Дата"), tr("Цена, {0}", { 0: m?.unit ?? "" })]} rows={[...pts].reverse().map((p) => [p.date.split("-").reverse().join("."), fmt(p.price)])} />
        </>
      )}
    </Card>
  );
}
