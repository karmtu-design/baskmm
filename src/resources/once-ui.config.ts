import type { OnceUIDataStyleConfig, OnceUIStyleConfig } from "@once-ui-system/core";

/**
 * Look and feel, in the spirit of the Magic Portfolio template: dark by default with a working
 * light/dark switch, translucent surfaces, playful corners, a dotted background.
 * Colours are BASK's own: gold brand on graphite.
 */
export const style: OnceUIStyleConfig = {
  theme: "system", // keep "system" so the switch works; the first visit uses defaultTheme
  defaultTheme: "dark",
  neutral: "slate",
  brandSeed: "#C9A45C", // BASK gold
  accent: "orange",
  solid: "contrast",
  solidStyle: "flat",
  border: "playful",
  surface: "translucent",
  transition: "all",
  scaling: "100",
  pageBackground: { dark: "#101820", light: "neutral-background-weak" },
};

export const dataStyle: OnceUIDataStyleConfig = {
  variant: "gradient",
  mode: "categorical",
  height: 24,
  axis: { stroke: "var(--neutral-alpha-weak)" },
  tick: { fill: "var(--neutral-on-background-weak)", fontSize: 11, line: false },
};

/** Background effects for every page: dots and a soft gold glow at the top. */
export const effects = {
  dots: { display: true, opacity: 40, size: "2", color: "brand-background-strong" },
  gradient: {
    display: true,
    opacity: 40,
    x: 50,
    y: 0,
    width: 120,
    height: 40,
    tilt: 0,
    colorStart: "brand-alpha-medium",
    colorEnd: "static-transparent",
  },
} as const;
