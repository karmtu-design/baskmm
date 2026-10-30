// Interface language. Russian is the source: every on-screen text is written in Russian and wrapped in tr(),
// which looks it up in the English or Chinese dictionary for the current language (and falls back to Russian).
// Works in both browser and server components: in the browser and while rendering client components it reads
// the language from React context; in server components from next-intl (registered in ./server.ts).
import * as React from "react";
import en from "./messages/en.json";
import zh from "./messages/zh.json";

export const LOCALES = ["ru", "en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", en: "English", zh: "中文" };
const INTL: Record<Locale, string> = { ru: "ru-RU", en: "en-GB", zh: "zh-CN" };
const DICT: Record<Locale, Record<string, string> | null> = { ru: null, en, zh };

// react-server (server components) has no createContext: there the language comes from the server hook
export const LocaleContext: React.Context<Locale> | null = typeof React.createContext === "function" ? React.createContext<Locale>(DEFAULT_LOCALE) : null;
let lastLocale: Locale = DEFAULT_LOCALE; // for texts made outside rendering, e.g. in click handlers
export function rememberLocale(l: Locale) {
  lastLocale = l;
}

function isSuspense(e: unknown) {
  return (
    (typeof e === "object" && e !== null && typeof (e as { then?: unknown }).then === "function") ||
    (e instanceof Error && /Suspense Exception|postpone|dynamic/i.test(e.message + String((e as { digest?: string }).digest ?? "")))
  );
}

export function currentLocale(): Locale {
  try {
    if (LocaleContext) return React.use(LocaleContext);
    const fromServer = (globalThis as { __baskServerLocale?: () => Locale }).__baskServerLocale;
    if (fromServer) return fromServer();
  } catch (e) {
    // React pauses rendering by throwing while the language is being read: let that through
    if (isSuspense(e)) throw e;
    /* not rendering right now */
  }
  return lastLocale;
}

/** Translates a Russian text into a given language; {0}, {1}… are filled from `vars`. */
export function translate(l: Locale, ru: string, vars?: Record<string | number, unknown>): string {
  const s = DICT[l]?.[ru] ?? ru;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m)) : s;
}

/** Translates a Russian interface text into the current language. */
export function tr(ru: string, vars?: Record<string | number, unknown>): string {
  return translate(currentLocale(), ru, vars);
}

/** Locale tag for dates and numbers: ru-RU, en-GB or zh-CN. */
export function loc(): string {
  return INTL[currentLocale()];
}

/** Russian has three plural forms; English two; Chinese one. */
export function plural(n: number, one: string, few: string, many: string): string {
  const l = currentLocale();
  if (l === "ru") {
    const m10 = n % 10,
      m100 = n % 100;
    const w = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
    return `${n.toLocaleString("ru-RU")} ${w}`;
  }
  return `${n.toLocaleString(INTL[l])} ${tr(n === 1 ? one : many)}`;
}
