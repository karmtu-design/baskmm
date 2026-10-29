// Daily metal prices from the public market-data page of Westmetall (official LME prices,
// London gold fixing, silver). No registration or key: the page is read once every few hours
// on the server and the prices are kept in the metal_prices table, which gives the day-to-day change
// and a fallback when the page cannot be read.
import { createClient } from "@/lib/supabase/server";

export const SOURCE_URL = "https://www.westmetall.com/en/markdaten.php";
const OZ_PER_KG = 32.1507466;

export type MetalDef = { key: string; name: string; symbol: string; unit: string; match: RegExp };

/** The metals shown on the home page, in this order. */
export const METALS: MetalDef[] = [
  { key: "gold", name: "Золото", symbol: "Au", unit: "$/унц", match: /^gold\b.*(fixing|usd)/i },
  { key: "silver", name: "Серебро", symbol: "Ag", unit: "$/унц", match: /^fine silver\b(?!.*processed)/i },
  { key: "copper", name: "Медь", symbol: "Cu", unit: "$/т", match: /^copper$/i },
  { key: "zinc", name: "Цинк", symbol: "Zn", unit: "$/т", match: /^zinc$/i },
  { key: "lead", name: "Свинец", symbol: "Pb", unit: "$/т", match: /^lead$/i },
  { key: "tin", name: "Олово", symbol: "Sn", unit: "$/т", match: /^tin$/i },
  { key: "nickel", name: "Никель", symbol: "Ni", unit: "$/т", match: /^nickel$/i },
  { key: "aluminium", name: "Алюминий", symbol: "Al", unit: "$/т", match: /^alumin(i)?um$/i },
];

export type ParsedPrice = { key: string; price: number; date: string; prev?: { price: number; date: string } };

// ---------- reading the page ----------

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const text = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();

/** "14,675.50" (English page) or "14.675,50" (German) → 14675.5 */
export function parseNumber(s: string): number | null {
  const t = s.replace(/\s/g, "");
  if (!/^-?[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  let n: string;
  if (/,\d{1,2}$/.test(t) && !/\.\d{1,2}$/.test(t)) n = t.replace(/\./g, "").replace(",", ".");
  else n = t.replace(/,/g, "");
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  januar: 1, februar: 2, märz: 3, maerz: 3, mai: 5, juni: 6, juli: 7, okt: 10, dez: 12,
};
/** "28. October 2026", "28 Oct 2026", "28.10.2026" → "2026-10-28" */
export function parseDate(s: string): string | null {
  let m = s.match(/(\d{1,2})\.?\s+([A-Za-zäÄ]+)\.?\s+(\d{4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

type Table = { title: string; dates: (string | null)[]; rows: string[][] };

export function parseTables(html: string): Table[] {
  return html
    .split(/<table[\s>]/i)
    .slice(1)
    .map((chunk) => {
      const body = chunk.split(/<\/table>/i)[0];
      const rows = body
        .split(/<tr[\s>]/i)
        .slice(1)
        .map((r) =>
          r
            .split(/<\/tr>/i)[0]
            .split(/<t[dh](?=[\s>])/i)
            .slice(1)
            .map((c) => text(c.replace(/^[^>]*>/, "")))
        )
        .filter((r) => r.length > 0);
      const head = rows[0] ?? [];
      return { title: text(body.slice(0, 2000)).slice(0, 200), dates: head.map(parseDate), rows };
    });
}

/** Pulls the prices out of the page. Returns only what it could read with confidence. */
export function extractPrices(html: string): ParsedPrice[] {
  const tables = parseTables(html);
  const out: ParsedPrice[] = [];
  // a cell counts only when it holds exactly one number (some rows show a buy–sell range instead)
  const cellNum = (c: string) => {
    const nums = c.match(/-?\d[\d.,]*/g) ?? [];
    return nums.length === 1 ? parseNumber(nums[0]) : null;
  };
  const firstNum = (cells: string[]) => cells.slice(1).map(cellNum);

  // LME table: «Settlement» / «US Dollar per ton»; one date for the whole table
  const lme = tables.find((t) => /settlement|dollar per ton|kasse/i.test(t.title) && !/stock|lager/i.test(t.title));
  if (lme) {
    const date = lme.dates.find(Boolean) ?? lme.rows.map((r) => r.map(parseDate).find(Boolean)).find(Boolean) ?? null;
    for (const m of METALS.filter((x) => x.unit === "$/т")) {
      const row = lme.rows.find((r) => m.match.test(r[0] ?? ""));
      const v = row ? firstNum(row).find((x) => x != null) : null;
      if (v && date) out.push({ key: m.key, price: v, date });
    }
  }

  // Precious metals: two dated columns (today, previous day)
  const prec = tables.find((t) => /gold/i.test(t.title) && t.rows.some((r) => /silver/i.test(r[0] ?? "")));
  const fx = tables.find((t) => t.rows.some((r) => /ecb|ezb/i.test(r[0] ?? "")));
  if (prec) {
    const [d0, d1] = prec.dates.filter(Boolean) as string[];
    const gold = prec.rows.find((r) => METALS[0].match.test(r[0] ?? "") && /usd|\$|oz|unze/i.test(r[0] ?? ""));
    if (gold && d0) {
      const [a, b] = firstNum(gold);
      if (a) out.push({ key: "gold", price: a, date: d0, prev: b && d1 ? { price: b, date: d1 } : undefined });
    }
    const silver = prec.rows.find((r) => METALS[1].match.test(r[0] ?? ""));
    const ecb = fx?.rows.find((r) => /ecb|ezb/i.test(r[0] ?? ""));
    if (silver && ecb && d0 && /eur/i.test(silver[0])) {
      const [s0, s1] = firstNum(silver);
      const [r0, r1] = firstNum(ecb);
      // EUR per kg → USD per troy ounce, at the ECB EUR/USD rate of the same day
      if (s0 && r0) {
        const usd = (eurKg: number, rate: number) => Math.round(((eurKg * rate) / OZ_PER_KG) * 100) / 100;
        out.push({
          key: "silver",
          price: usd(s0, r0),
          date: d0,
          prev: s1 && r1 && d1 ? { price: usd(s1, r1), date: d1 } : undefined,
        });
      }
    }
  }
  return out;
}

// ---------- prices for the home page ----------

export type MetalQuote = MetalDef & { price: number; date: string; change: number | null; prevDate: string | null };
export type MetalBoard = { quotes: MetalQuote[]; live: boolean; error?: string };

async function fetchPage(): Promise<string> {
  const res = await fetch(SOURCE_URL, {
    headers: { "user-agent": "BASK Metals and Mining portfolio (daily price board)", accept: "text/html" },
    next: { revalidate: 6 * 3600 }, // the page is read at most every 6 hours; prices change once a day
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`источник ответил ${res.status}`);
  return res.text();
}

export async function getMetalBoard(): Promise<MetalBoard> {
  const supabase = await createClient();
  let live = false;
  let error: string | undefined;

  try {
    const parsed = extractPrices(await fetchPage());
    if (parsed.length === 0) throw new Error("на странице источника не нашлось цен");
    live = true;
    const rows = parsed.flatMap((p) => {
      const unit = METALS.find((m) => m.key === p.key)!.unit;
      const r = [{ metal: p.key, price_date: p.date, price: p.price, unit }];
      if (p.prev) r.push({ metal: p.key, price_date: p.prev.date, price: p.prev.price, unit });
      return r;
    });
    await supabase.from("metal_prices").upsert(rows, { onConflict: "metal,price_date" });
  } catch (e) {
    error = (e as Error).message;
  }

  // last two stored days per metal: today's price and the change against the previous day
  const { data } = await supabase
    .from("metal_prices")
    .select("metal, price_date, price")
    .order("price_date", { ascending: false })
    .limit(200);
  const quotes: MetalQuote[] = [];
  for (const m of METALS) {
    const hist = (data ?? []).filter((r) => r.metal === m.key);
    if (!hist.length) continue;
    const [cur, prev] = hist;
    const price = Number(cur.price);
    quotes.push({
      ...m,
      price,
      date: cur.price_date,
      change: prev ? (price - Number(prev.price)) / Number(prev.price) : null,
      prevDate: prev?.price_date ?? null,
    });
  }
  return { quotes, live, error };
}
