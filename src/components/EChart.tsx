"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, MarkLineComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);

/** Colours a chart needs, taken from the site theme so light and dark both work. */
export type ChartTheme = { text: string; muted: string; grid: string; surface: string; series: string; wash: string; font: string };

function readTheme(): ChartTheme {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const v = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
  const dark = root.getAttribute("data-theme") !== "light";
  // one validated blue per theme (single series: no legend, the title names it)
  const series = dark ? "#3987e5" : "#2a78d6";
  return {
    text: v("--neutral-on-background-strong", dark ? "#f0efec" : "#0b0b0b"),
    muted: v("--neutral-on-background-weak", dark ? "#9a9a96" : "#52514e"),
    grid: v("--neutral-alpha-weak", dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"),
    surface: v("--page-background", dark ? "#101820" : "#ffffff"),
    series,
    wash: dark ? "rgba(57,135,229,0.12)" : "rgba(42,120,214,0.10)",
    font: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
}

/** An ECharts chart that follows the site theme and the width of its box. */
export default function EChart({ option, height = 280, label }: { option: (t: ChartTheme, width: number) => EChartsCoreOption; height?: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!box.current || !theme) return;
    const chart = echarts.init(box.current, undefined, { renderer: "svg" });
    let width = box.current.clientWidth;
    chart.setOption(option(theme, width));
    // the option may depend on the width (e.g. tilted axis labels on a phone)
    const ro = new ResizeObserver(() => {
      const w = box.current?.clientWidth ?? width;
      if (Math.abs(w - width) > 40) {
        width = w;
        chart.setOption(option(theme, w), true);
      }
      chart.resize();
    });
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [option, theme]);

  return <div ref={box} role="img" aria-label={label} style={{ width: "100%", height }} />;
}
