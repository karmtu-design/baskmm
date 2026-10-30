import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from "./index";

// The language is kept in a cookie: there are no /en or /zh addresses, links stay the same for everyone.
export default getRequestConfig(async () => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale = c && LOCALES.includes(c) ? c : DEFAULT_LOCALE;
  return { locale, messages: {} };
});
