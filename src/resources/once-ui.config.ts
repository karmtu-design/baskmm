import type { OnceUIDataStyleConfig, OnceUIStyleConfig } from "@once-ui-system/core";

/**
 * «Белый и золото»: light by default (the warm white of the intro video), black buttons, gold only in
 * the details; the dark theme is near-black with gold buttons. The switch is in the menu.
 */
export const style: OnceUIStyleConfig = {
  theme: "system", // keep "system" so the switch works; the first visit uses defaultTheme
  defaultTheme: "light",
  neutral: "gray",
  brandSeed: "#C9A45C", // BASK gold
  accent: "orange",
  solid: "contrast",
  solidStyle: "flat",
  border: "playful",
  surface: "filled",
  transition: "all",
  scaling: "100",
  pageBackground: { dark: "#0B0B0C", light: "#F9F7F3" }, // light = the intro video background, so the intro melts into the site
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
  dots: { display: false, opacity: 40, size: "2", color: "brand-background-strong" },
  gradient: {
    display: false,
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
