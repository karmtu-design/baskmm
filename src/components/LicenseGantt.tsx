"use client";

import { tr, currentLocale } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Row } from "@once-ui-system/core";
import type Gantt from "frappe-gantt";
import type { GanttTask } from "frappe-gantt";

export type GanttLicense = {
  id: number;
  name: string;
  number: string;
  company: string;
  start: string;
  end: string;
  status: string | null;
  type: string | null;
};

const fmt = (iso: string) => iso.split("-").reverse().join(".");

/** All licences on one timeline: from issue to expiry, with today marked and the elapsed part filled. */
export default function LicenseGantt({ licenses }: { licenses: GanttLicense[] }) {
  const router = useRouter();
  const lang = currentLocale();
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<Gantt | null>(null);
  const [mode, setMode] = useState<"Year" | "Month">("Year");

  useEffect(() => {
    if (!box.current || licenses.length === 0) return;
    let alive = true;
    import("frappe-gantt").then(({ default: G }) => {
      if (!alive || !box.current) return;
      box.current.innerHTML = "";
      const now = Date.now();
      const tasks: GanttTask[] = licenses.map((l) => {
        const s = new Date(l.start).getTime(),
          e = new Date(l.end).getTime();
        const progress = Math.max(0, Math.min(100, ((now - s) / (e - s || 1)) * 100));
        const cls = l.status === "истекла" || e < now ? "g-expired" : e - now < 365 * 86400000 ? "g-soon" : l.type === "Добыча" ? "g-mining" : "g-explore";
        return { id: String(l.id), name: `${l.name} · ${l.number}`, start: l.start, end: l.end, progress: Math.round(progress), custom_class: cls };
      });
      chart.current = new G(box.current, tasks, {
        view_mode: mode,
        language: lang,
        readonly: true,
        today_button: false,
        holidays: {},
        bar_height: 26,
        padding: 16,
        lines: "vertical",
        scroll_to: "start",
        infinite_padding: false,
        auto_move_label: true,
        popup: (p) => {
          const l = licenses.find((x) => String(x.id) === p.task.id);
          p.set_title(l ? `${l.name}` : p.task.name);
          p.set_subtitle(l ? `${l.company} · ${l.number}` : "");
          p.set_details(l ? tr("{0} — {1}<br/>Прошло {2}% срока{3}", { 0: fmt(l.start), 1: fmt(l.end), 2: Math.round(p.task.progress ?? 0), 3: l.status ? `<br/>${tr("Статус")}: ${tr(l.status)}` : "" }) : "");
        },
        popup_on: "hover",
        on_click: (t: GanttTask) => router.push(`/licenses/${t.id}`),
      });
    });
    return () => {
      alive = false;
    };
  }, [licenses, mode, router, lang]);

  if (licenses.length === 0) return <p className="muted">{tr("У лицензий не указаны даты выдачи и окончания.")}</p>;
  return (
    <div className="gantt-shell">
      <link rel="stylesheet" href="/vendor/frappe-gantt.css" precedence="default" />
      <Row wrap gap="12" vertical="center" marginBottom="12">
        <span className="cal-legend">
          <span className="cal-dot g-explore" aria-hidden />{" "}{tr("Разведка")}</span>
        <span className="cal-legend">
          <span className="cal-dot g-mining" aria-hidden />{" "}{tr("Добыча")}</span>
        <span className="cal-legend">
          <span className="cal-dot g-soon" aria-hidden />{" "}{tr("Истекает в течение года")}</span>
        <span className="cal-legend">
          <span className="cal-dot g-expired" aria-hidden />{" "}{tr("Истекла")}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
          <button type="button" className={`chip${mode === "Year" ? " is-on" : ""}`} onClick={() => setMode("Year")}>{tr("По годам")}</button>
          <button type="button" className={`chip${mode === "Month" ? " is-on" : ""}`} onClick={() => setMode("Month")}>{tr("По месяцам")}</button>
        </span>
      </Row>
      <div ref={box} className="gantt-box" />
      <p className="muted" style={{ marginTop: 8 }}>{tr("Полоса: от даты выдачи до окончания срока. Закрашенная часть показывает, сколько срока уже прошло. Нажмите на полосу, чтобы открыть лицензию.")}</p>
    </div>
  );
}
