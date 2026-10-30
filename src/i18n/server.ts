// Server side of the interface language. next-intl keeps it in the NEXT_LOCALE cookie (see ./request.ts).
// Server components call tr() synchronously, often after an `await`, where React hooks are not available,
// so the cookie is read from Next's per-request storage (the same place cookies() reads it from).
// The root layout reads the cookie through next-intl, which keeps every page rendered per request.
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, type Locale } from "./index";

(globalThis as { __baskServerLocale?: () => Locale }).__baskServerLocale = () => {
  const store = workUnitAsyncStorage.getStore() as { cookies?: { get?: (n: string) => { value?: string } | undefined } } | undefined;
  const value = typeof store?.cookies?.get === "function" ? store.cookies.get(LOCALE_COOKIE)?.value : undefined;
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
};

export {};
