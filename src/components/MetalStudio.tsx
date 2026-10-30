"use client";

// The metal price cards on the home page, made interactive: click a metal to open its price history
// and a calculator «how much is this deposit worth at today's price» (metal tonnes, or ore × grade).
import { useCallback, useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { tr, loc } from "@/i18n";
import EChart, { type ChartTheme } from "./EChart";
import type { MetalQuote as FullQuote } from "@/lib/metals";

// without the parsing pattern, which cannot be passed from the server
type MetalQuote = Omit<FullQuote, "match">;

type Point = { date: string; price: number };
const OZ_PER_T = 32150.7466;
const isOz = (q: MetalQuote) => /унц|oz/i.test(q.unit);
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(loc(), { day: "numeric", month: "short" });
const nf = (v: number, d = 0) => v.toLocaleString(loc(), { maximumFractionDigits: d });
const money = (v: number, cur: "USD" | "KZT") =>
  new Intl.NumberFormat(loc(), { style: "currency", currency: cur, currencyDisplay: "narrowSymbol", notation: v >= 1e6 ? "compact" : "standard", maximumFractionDigits: v >= 1e6 ? 2 : 0 }).format(v);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function MetalStudio({ quotes, history, usdKzt }: { quotes: MetalQuote[]; history: Record<string, Point[]>; usdKzt: number | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const q = quotes.find((x) => x.key === open) ?? null;

  const renderCards = (dup: boolean) =>
        quotes.map((x) => {
          const up = x.change != null && x.change > 0.00005;
          const down = x.change != null && x.change < -0.00005;
          const on = x.key === open;
          return (
            <button
              key={x.key}
              type="button"
              tabIndex={dup ? -1 : undefined}
              className={`metal-card is-button${on ? " is-open" : ""}`}
              aria-expanded={on}
              onClick={() => setOpen(on ? null : x.key)}
              title={tr("Нажмите, чтобы открыть график и калькулятор")}
            >
              <div className="metal-head">
                <span className="metal-sym">{x.symbol}</span>
                <span className="metal-name">{tr(x.name)}</span>
              </div>
              <div className="metal-price">
                {nf(x.price, isOz(x) || x.price < 100 ? 2 : 0)} <span className="metal-unit">{tr(x.unit)}</span>
              </div>
              {/* the line is drawn from the second recorded day; until then an empty strip keeps the cards even */}
              {x.history.length >= 2 ? <Spark values={x.history} /> : <span className="metal-spark" aria-hidden />}
              <div className={`metal-change${up ? " is-up" : down ? " is-down" : ""}`}>
                {x.change == null ? (
                  <span className="metal-muted">{fmtDate(x.date)}</span>
                ) : (
                  <>
                    {up ? "▲" : down ? "▼" : "•"} {nf(Math.abs(x.change * 100), 1)}%<span className="metal-muted"> · {fmtDate(x.date)}</span>
                  </>
                )}
              </div>
            </button>
          );
        });

  return (
    <>
      {/* a running line: the cards move slowly to the left and stop under the mouse or when a metal is open */}
      <div className={`metal-ticker${open ? " is-paused" : ""}`} style={{ ["--ticker-time" as string]: `${Math.max(30, quotes.length * 6)}s` }}>
        <div className="metal-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="metal-run" aria-hidden={copy === 1 || undefined}>
              {renderCards(copy === 1)}
            </div>
          ))}
        </div>
      </div>
      {q && <MetalPanel key={q.key} q={q} points={history[q.key] ?? []} usdKzt={usdKzt} onClose={() => setOpen(null)} />}
    </>
  );
}

function MetalPanel({ q, points, usdKzt, onClose }: { q: MetalQuote; points: Point[]; usdKzt: number | null; onClose: () => void }) {
  const precious = isOz(q);
  const [range, setRange] = useState<30 | 90 | 0>(0);
  const pts = useMemo(() => (range ? points.slice(-range) : points), [points, range]);

  // calculator
  const [mode, setMode] = useState<"metal" | "ore">("ore");
  const [metalT, setMetalT] = useState(precious ? 10 : 50000);
  const [oreMt, setOreMt] = useState(precious ? 5 : 50);
  const [grade, setGrade] = useState(precious ? 2 : 0.5); // g/t for gold and silver, % for the rest
  const [recovery, setRecovery] = useState(85);

  const contained = mode === "metal" ? metalT : precious ? (oreMt * 1e6 * grade) / 1e6 : oreMt * 1e6 * (grade / 100);
  const recovered = contained * (recovery / 100);
  const usd = precious ? recovered * OZ_PER_T * q.price : recovered * q.price;
  const perTonneOre = mode === "ore" && oreMt > 0 ? usd / (oreMt * 1e6) : null;
  const fmtP = useCallback((v: number) => nf(v, precious ? 2 : 0), [precious]);

  const option = useMemo(
    () =>
      (t: ChartTheme): EChartsCoreOption => ({
        animationDuration: 300,
        textStyle: { fontFamily: t.font, color: t.text },
        grid: { left: 8, right: 64, top: 12, bottom: 4, containLabel: true },
        xAxis: { type: "category", boundaryGap: false, data: pts.map((p) => fmtDate(p.date)), axisTick: { show: false }, axisLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.muted, fontSize: 11 } },
        yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.muted, formatter: (v: number) => nf(v) } },
        tooltip: {
          trigger: "axis",
          backgroundColor: t.surface,
          borderColor: t.grid,
          textStyle: { color: t.text, fontFamily: t.font, fontSize: 12 },
          axisPointer: { type: "line", lineStyle: { color: t.muted, width: 1 } },
          formatter: (ps: { dataIndex: number; value: number }[]) =>
            `<b>${fmtP(ps[0].value)} ${esc(tr(q.unit))}</b><br/><span style="opacity:.75">${esc(pts[ps[0].dataIndex].date.split("-").reverse().join("."))}</span>`,
        },
        series: [
          {
            type: "line",
            data: pts.map((p) => p.price),
            symbol: "circle",
            symbolSize: 8,
            showSymbol: pts.length < 3,
            lineStyle: { width: 2, color: t.series },
            itemStyle: { color: t.series, borderColor: t.surface, borderWidth: 2 },
            areaStyle: { color: t.wash },
            endLabel: { show: true, color: t.text, fontSize: 12, formatter: (p: { value: number }) => fmtP(p.value) },
          },
        ],
      }),
    [pts, fmtP, q.unit]
  );

  const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, unit: string) => (
    <label className="calc-field">
      <span className="calc-label">{label}</span>
      <span className="calc-inputs">
        <input type="range" min={min} max={max} step={step} value={Math.min(max, value)} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
        <input type="number" className="field calc-num" min={0} step={step} value={value} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} aria-label={label} />
        <span className="calc-unit">{unit}</span>
      </span>
    </label>
  );

  return (
    <section className="metal-panel" aria-label={tr(q.name)}>
      <header className="metal-panel-head">
        <h3>
          <span className="metal-sym">{q.symbol}</span> {tr(q.name)}: {fmtP(q.price)} {tr(q.unit)}
        </h3>
        <button type="button" className="nav-close" onClick={onClose} aria-label={tr("Закрыть")}>
          ×
        </button>
      </header>
      <div className="metal-panel-body">
        <div className="metal-panel-chart">
          <div className="chip-row" role="group" aria-label={tr("Период")}>
            {([30, 90, 0] as const).map((r) => (
              <button key={r} type="button" className={`chip${range === r ? " is-on" : ""}`} aria-pressed={range === r} onClick={() => setRange(r)}>
                {r === 30 ? tr("30 дней") : r === 90 ? tr("90 дней") : tr("Всё время")}
              </button>
            ))}
          </div>
          {pts.length < 2 ? (
            <p className="metal-muted">{tr("История цен собирается с момента подключения: график появится, когда будет записано несколько дней.")}</p>
          ) : (
            <EChart option={option} height={240} label={tr("Цена: {0}, от {1} до {2} {3}", { 0: tr(q.name), 1: fmtP(pts[0].price), 2: fmtP(pts[pts.length - 1].price), 3: tr(q.unit) })} />
          )}
        </div>

        <div className="metal-calc">
          <h4>{tr("Сколько стоит металл в недрах")}</h4>
          <div className="chip-row" role="group" aria-label={tr("Что известно")}>
            <button type="button" className={`chip${mode === "ore" ? " is-on" : ""}`} aria-pressed={mode === "ore"} onClick={() => setMode("ore")}>
              {tr("Руда и содержание")}
            </button>
            <button type="button" className={`chip${mode === "metal" ? " is-on" : ""}`} aria-pressed={mode === "metal"} onClick={() => setMode("metal")}>
              {tr("Металл, т")}
            </button>
          </div>
          {mode === "ore" ? (
            <>
              {slider(tr("Руда"), oreMt, setOreMt, 0, precious ? 100 : 1000, precious ? 0.1 : 1, tr("млн т"))}
              {slider(tr("Содержание"), grade, setGrade, 0, precious ? 20 : 5, precious ? 0.05 : 0.01, precious ? tr("г/т") : "%")}
            </>
          ) : (
            slider(tr("Металл"), metalT, setMetalT, 0, precious ? 500 : 2_000_000, precious ? 0.5 : 1000, tr("т"))
          )}
          {slider(tr("Извлечение"), recovery, setRecovery, 0, 100, 1, "%")}

          <dl className="calc-out">
            <div>
              <dt>{tr("Металла в недрах")}</dt>
              <dd>
                {nf(contained, contained < 100 ? 2 : 0)} {tr("т")}
                {precious && <small> · {nf(contained * OZ_PER_T / 1e6, 2)} {tr("млн унц")}</small>}
              </dd>
            </div>
            <div>
              <dt>{tr("Стоимость извлекаемого металла")}</dt>
              <dd className="calc-big">{money(usd, "USD")}</dd>
            </div>
            {usdKzt && (
              <div>
                <dt>{tr("В тенге по курсу Нацбанка")}</dt>
                <dd>{money(usd * usdKzt, "KZT")}</dd>
              </div>
            )}
            {perTonneOre != null && (
              <div>
                <dt>{tr("На тонну руды")}</dt>
                <dd>{money(perTonneOre, "USD")}</dd>
              </div>
            )}
          </dl>
          <p className="metal-muted">{tr("Валовая стоимость по сегодняшней цене, без затрат на добычу и переработку. Для первичной оценки объекта, не для отчётности.")}</p>
        </div>
      </div>
    </section>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 120,
    h = 24;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="metal-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
