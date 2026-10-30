"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { tr, loc } from "@/i18n";
import EChart, { type ChartTheme } from "./EChart";
import type { ProfilePoint } from "@/lib/elevation";

const nf = (v: number, d = 0) => v.toLocaleString(loc(), { maximumFractionDigits: d });

/** Height along a drawn line: distance from the start on the bottom, metres above sea level on the side. */
export default function ElevationChart({ points, onClose }: { points: ProfilePoint[]; onClose: () => void }) {
  const ok = points.filter((p) => p.h != null) as (ProfilePoint & { h: number })[];
  const stats = useMemo(() => {
    if (ok.length < 2) return null;
    let up = 0,
      down = 0,
      steep = 0;
    for (let i = 1; i < ok.length; i++) {
      const dh = ok[i].h - ok[i - 1].h;
      const dx = (ok[i].km - ok[i - 1].km) * 1000;
      if (dh > 0) up += dh;
      else down -= dh;
      if (dx > 0) steep = Math.max(steep, Math.abs(dh / dx) * 100);
    }
    const hs = ok.map((p) => p.h);
    return { min: Math.min(...hs), max: Math.max(...hs), up, down, steep, total: ok[ok.length - 1].km };
  }, [ok]);

  const option = useMemo(
    () =>
      (t: ChartTheme): EChartsCoreOption => ({
        animationDuration: 300,
        textStyle: { fontFamily: t.font, color: t.text },
        grid: { left: 8, right: 16, top: 12, bottom: 4, containLabel: true },
        xAxis: {
          type: "value",
          min: 0,
          max: stats?.total,
          axisLabel: { color: t.muted, formatter: (v: number) => `${nf(v, 1)} ${tr("км")}` },
          splitLine: { show: false },
          axisLine: { lineStyle: { color: t.grid } },
        },
        yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.muted, formatter: (v: number) => `${nf(v)} ${tr("м")}` } },
        tooltip: {
          trigger: "axis",
          backgroundColor: t.surface,
          borderColor: t.grid,
          textStyle: { color: t.text, fontFamily: t.font, fontSize: 12 },
          axisPointer: { type: "line", lineStyle: { color: t.muted, width: 1 } },
          formatter: (ps: { value: [number, number] }[]) => `<b>${nf(ps[0].value[1])} ${tr("м")}</b><br/><span style="opacity:.75">${nf(ps[0].value[0], 2)} ${tr("км от начала")}</span>`,
        },
        series: [
          {
            type: "line",
            data: ok.map((p) => [p.km, p.h]),
            showSymbol: false,
            lineStyle: { width: 2, color: t.series },
            areaStyle: { color: t.wash },
          },
        ],
      }),
    [ok, stats]
  );

  return (
    <div className="elev">
      <div className="elev-head">
        <b>{tr("Профиль рельефа")}</b>
        {stats && (
          <span>
            {tr("{0} км · высота от {1} до {2} м · подъём {3} м, спуск {4} м · самый крутой участок {5}%", {
              0: nf(stats.total, 2),
              1: nf(stats.min),
              2: nf(stats.max),
              3: nf(stats.up),
              4: nf(stats.down),
              5: nf(stats.steep, 1),
            })}
          </span>
        )}
        <button type="button" className="nav-close" onClick={onClose} aria-label={tr("Закрыть")}>
          ×
        </button>
      </div>
      {stats ? (
        <EChart option={option} height={200} label={tr("Профиль рельефа")} />
      ) : (
        <p className="metal-muted">{tr("Не удалось получить высоты. Проверьте интернет и попробуйте ещё раз.")}</p>
      )}
      <p className="metal-muted">{tr("Высоты по открытой модели рельефа (AWS Terrain Tiles), точность — около 10–30 м по высоте. Для прикидки трассы, не для проекта.")}</p>
    </div>
  );
}
