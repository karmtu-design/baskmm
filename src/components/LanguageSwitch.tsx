"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, currentLocale, tr, type Locale } from "@/i18n";
import { setLocale } from "@/i18n/actions";

const SHORT: Record<Locale, string> = { ru: "RU", en: "EN", zh: "中" };

/** RU / EN / 中: the interface language for this browser (kept in a cookie for a year). */
export default function LanguageSwitch({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const now = currentLocale();
  const [pending, start] = useTransition();
  return (
    <div className={`lang-switch${compact ? " is-compact" : ""}`} role="group" aria-label={tr("Язык интерфейса")}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === now}
          title={LOCALE_NAMES[l]}
          disabled={pending}
          onClick={() =>
            l !== now &&
            start(async () => {
              await setLocale(l);
              router.refresh();
            })
          }
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
