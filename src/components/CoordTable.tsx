"use client";

// Table for typing the corner points of a licence by hand, as in the e-licensing portal:
// one card per site (участок), a row per corner point, degrees · minutes · seconds for latitude and longitude.
// Typing jumps to the next cell after two digits; a list pasted from Word or Excel fills the rows itself.
import { tr } from "@/i18n";
import { useRef } from "react";
import { parsePointsText } from "@/lib/coords";

export type DMSRow = { la: [string, string, string]; lo: [string, string, string] };
export type Site = { id: number; rows: DMSRow[] };

let nextId = 1;
export const emptyRow = (): DMSRow => ({ la: ["", "", ""], lo: ["", "", ""] });
export const newSite = (rows = 4): Site => ({ id: nextId++, rows: Array.from({ length: rows }, emptyRow) });

/** Decimal degrees → the three cells (seconds to hundredths, never 60.00). */
export function toCells(v: number): [string, string, string] {
  const total = Math.round(Math.abs(v) * 360000);
  const d = Math.floor(total / 360000), m = Math.floor((total % 360000) / 6000), s = (total % 6000) / 100;
  return [String(d), String(m), String(Number(s.toFixed(2)))];
}
export const rowFrom = (lat: number, lon: number): DMSRow => ({ la: toCells(lat), lo: toCells(lon) });

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".").trim()));
/** One angle from its cells, or a reason why it cannot be read. */
function angle(c: [string, string, string], max: number): number | string | null {
  if (c.every((x) => x.trim() === "")) return null;
  const [d, m, s] = c.map((x, i) => (x.trim() === "" && i > 0 ? 0 : num(x)));
  if ([d, m, s].some((x) => Number.isNaN(x))) return tr("не число");
  if (m >= 60) return tr("минуты должны быть меньше 60");
  if (s >= 60) return tr("секунды должны быть меньше 60");
  const v = d + m / 60 + s / 3600;
  if (v > max) return tr("градусы вне допустимого диапазона");
  return v;
}
export type RowState = { lat: number | null; lon: number | null; error: string | null; empty: boolean };
export function readRow(r: DMSRow): RowState {
  const a = angle(r.la, 90), b = angle(r.lo, 180);
  const empty = a === null && b === null;
  if (empty) return { lat: null, lon: null, error: null, empty };
  if (typeof a === "string") return { lat: null, lon: null, error: tr("широта: {0}", { 0: a }), empty };
  if (typeof b === "string") return { lat: null, lon: null, error: tr("долгота: {0}", { 0: b }), empty };
  if (a === null) return { lat: null, lon: null, error: tr("не заполнена широта"), empty };
  if (b === null) return { lat: null, lon: null, error: tr("не заполнена долгота"), empty };
  return { lat: a, lon: b, error: null, empty };
}

export default function CoordTable({ sites, onChange }: { sites: Site[]; onChange: (s: Site[]) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const set = (si: number, rows: DMSRow[]) => onChange(sites.map((s, i) => (i === si ? { ...s, rows } : s)));

  function focusNext(el: HTMLInputElement, down = false) {
    const all = [...(box.current?.querySelectorAll<HTMLInputElement>("input.coord-in") ?? [])];
    const i = all.indexOf(el);
    const target = down ? all[i + 6] : all[i + 1];
    if (target) {
      target.focus();
      target.select();
    }
  }

  function edit(si: number, ri: number, part: "la" | "lo", ci: number, value: string, el: HTMLInputElement) {
    const v = value.replace(/[^\d.,]/g, "");
    const rows = sites[si].rows.map((r, i) => (i === ri ? { ...r, [part]: r[part].map((x, j) => (j === ci ? v : x)) as DMSRow["la"] } : r));
    set(si, rows);
    // degrees and minutes are two digits here (Kazakhstan: 40–56° N, 46–88° E): move on by itself
    if (ci < 2 && /^\d{2}$/.test(v) && v !== el.dataset.prev) focusNext(el);
    el.dataset.prev = v;
  }

  function paste(si: number, ri: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/\n|°|\t|;/.test(text.trim()) && !/\d\s+\d+\s+\d/.test(text)) return; // a single number: paste as usual
    const r = parsePointsText(text, { system: "wgs84", lonFirst: false });
    if (!r.points.length) return;
    e.preventDefault();
    const rows = [...sites[si].rows];
    r.points.forEach(([lon, lat], k) => (rows[ri + k] = rowFrom(lat, lon)));
    set(si, rows);
  }

  return (
    <div className="coord-sites" ref={box}>
      {sites.map((s, si) => (
        <div className="coord-site" key={s.id}>
          <div className="coord-head">
            <b>{tr("Участок {0}", { 0: si + 1 })}</b>
            <span className="coord-head-tools">
              <button type="button" className="coord-btn" title={tr("Копия участка")} aria-label={tr("Копия участка")}
                onClick={() => onChange([...sites.slice(0, si + 1), { id: nextId++, rows: s.rows.map((r) => ({ la: [...r.la], lo: [...r.lo] }) as DMSRow) }, ...sites.slice(si + 1)])}>⧉</button>
              {sites.length > 1 && (
                <button type="button" className="coord-btn" title={tr("Удалить участок")} aria-label={tr("Удалить участок")}
                  onClick={() => confirm(tr("Удалить участок {0} со всеми точками?", { 0: si + 1 })) && onChange(sites.filter((_, i) => i !== si))}>🗑</button>
              )}
            </span>
          </div>
          <div className="coord-scroll">
            <table className="coord-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="coord-n">№</th>
                  <th colSpan={3}>{tr("Северная широта")}</th>
                  <th colSpan={3}>{tr("Восточная долгота")}</th>
                  <th rowSpan={2} />
                </tr>
                <tr className="coord-sub">
                  {[0, 1].flatMap((k) => [tr("градусы"), tr("минуты"), tr("секунды")].map((h) => <th key={k + h}>{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, ri) => {
                  const st = readRow(r);
                  return (
                    <tr key={ri} className={st.error ? "is-bad" : undefined} title={st.error ?? undefined}>
                      <td className="coord-n">{ri + 1}</td>
                      {(["la", "lo"] as const).flatMap((part) =>
                        [0, 1, 2].map((ci) => (
                          <td key={part + ci}>
                            <input
                              className="coord-in"
                              inputMode="decimal"
                              value={r[part][ci]}
                              placeholder="0"
                              aria-label={`${tr("Точка {0}", { 0: ri + 1 })}, ${part === "la" ? tr("широта") : tr("долгота")}, ${[tr("градусы"), tr("минуты"), tr("секунды")][ci]}`}
                              onChange={(e) => edit(si, ri, part, ci, e.target.value, e.target)}
                              onPaste={(e) => paste(si, ri, e)}
                              onKeyDown={(e) => {
                                // a space works like Tab: handy after the seconds
                                if (e.key === " ") {
                                  e.preventDefault();
                                  return focusNext(e.currentTarget);
                                }
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                if (ri === s.rows.length - 1) {
                                  set(si, [...s.rows, emptyRow()]);
                                  const el = e.currentTarget;
                                  setTimeout(() => focusNext(el, true), 0);
                                } else focusNext(e.currentTarget, true);
                              }}
                            />
                          </td>
                        ))
                      )}
                      <td className="coord-del">
                        <button type="button" className="coord-btn" aria-label={tr("Удалить точку {0}", { 0: ri + 1 })} title={tr("Удалить точку")}
                          onClick={() => set(si, s.rows.length > 1 ? s.rows.filter((_, i) => i !== ri) : [emptyRow()])}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="coord-foot">
            <span className="coord-kind">▱ {tr("Полигон")}</span>
            <button type="button" className="coord-add" onClick={() => set(si, [...s.rows, emptyRow()])}>
              + {tr("Точка")}
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="coord-add-site" onClick={() => onChange([...sites, newSite()])}>
        + {tr("Добавить участок")}
      </button>
    </div>
  );
}
