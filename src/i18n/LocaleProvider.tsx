"use client";

import { LocaleContext, rememberLocale, type Locale } from "./index";

/** Gives every client component the interface language chosen on the server. */
export default function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  rememberLocale(locale);
  const Ctx = LocaleContext!;
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}
