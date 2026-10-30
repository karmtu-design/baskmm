import { getLocale } from "next-intl/server";
import { translate, type Locale } from "./index";

/** Page title in the interface language: export const generateMetadata = pageTitle("Реестр лицензий"). */
export function pageTitle(ru: string) {
  return async () => ({ title: translate((await getLocale()) as Locale, ru) });
}
