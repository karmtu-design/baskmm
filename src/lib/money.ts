// Money shown and added up the same way everywhere in «Финансы».
// Amounts are added in whole tiyn (hundredths) so 0.1 + 0.2 is exactly 0.30, never 0.30000000004.
import { loc } from "@/i18n";

export const CURRENCIES = ["KZT", "USD", "CNY", "EUR", "RUB"];
const SIGN: Record<string, string> = { KZT: "₸", USD: "$", CNY: "¥", EUR: "€", RUB: "₽" };

export const cents = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100);
export const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, x) => s + cents(x), 0) / 100;

export function money(v: number | null | undefined, cur = "KZT", digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v).toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: digits });
  return `${n} ${SIGN[cur] ?? cur}`;
}

/** Amount in tenge at the given rates (tenge per unit); null when the rate is unknown. */
export function toKzt(v: number | null | undefined, cur: string, rates: Record<string, number>) {
  if (v == null) return null;
  const r = cur === "KZT" ? 1 : rates[cur];
  return r ? Math.round(Number(v) * r * 100) / 100 : null;
}

/** Totals per currency: { KZT: 1200000, USD: 3500 } */
export function byCurrency<T>(rows: T[], amount: (r: T) => number | null | undefined, currency: (r: T) => string) {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const c = currency(r) || "KZT";
    out[c] = (cents(out[c]) + cents(amount(r))) / 100;
  }
  return out;
}

export const daysTo = (iso: string | null | undefined, today = new Date()) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 864e5);
};

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
