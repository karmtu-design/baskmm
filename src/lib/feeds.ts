// Free outside data for the home page, read without keys or sign-up:
// exchange rates of the National Bank of Kazakhstan (its RSS page) and industry news (Google News RSS).

export type Rate = { code: string; name: string; rate: number; per: number; change: number | null };
export type Rates = { date: string; rates: Rate[] };
export type NewsItem = { title: string; link: string; source: string | null; date: string | null };

/** The currencies shown, in this order. */
export const RATE_CODES = ["USD", "CNY", "EUR", "RUB"];

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim()) : null;
};
function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}
const items = (xml: string) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);

/** nationalbank.kz/rss/get_rates.cfm?fdate=DD.MM.YYYY → rates of the chosen currencies. */
export function parseRates(xml: string, date: string): Rates | null {
  const rates: Rate[] = [];
  for (const it of items(xml)) {
    const code = tag(it, "title")?.toUpperCase();
    const rate = Number((tag(it, "description") ?? "").replace(",", "."));
    if (!code || !RATE_CODES.includes(code) || !isFinite(rate) || rate <= 0) continue;
    const ch = Number((tag(it, "change") ?? "").replace(",", ".").replace(/^\+/, ""));
    rates.push({ code, name: tag(it, "fullname") ?? code, rate, per: Number(tag(it, "quant")) || 1, change: isFinite(ch) ? ch : null });
  }
  rates.sort((a, b) => RATE_CODES.indexOf(a.code) - RATE_CODES.indexOf(b.code));
  return rates.length ? { date, rates } : null;
}

/** Any RSS 2.0 feed → items (Google News puts « - Source» at the end of the title). */
export function parseNews(xml: string, max = 6): NewsItem[] {
  const out: NewsItem[] = [];
  for (const it of items(xml)) {
    let title = tag(it, "title");
    const link = tag(it, "link");
    if (!title || !link || !/^https?:\/\//.test(link)) continue;
    const source = tag(it, "source");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const d = tag(it, "pubDate");
    const date = d && !isNaN(Date.parse(d)) ? new Date(d).toISOString() : null;
    out.push({ title, link, source, date });
    if (out.length >= max) break;
  }
  return out;
}

/** What to search news for, in the interface language. */
export const NEWS_QUERY: Record<string, { q: string; hl: string; gl: string; ceid: string }> = {
  ru: { q: "Казахстан (недропользование OR месторождение OR горнодобывающая)", hl: "ru", gl: "KZ", ceid: "KZ:ru" },
  en: { q: "Kazakhstan (mining OR deposit OR subsoil)", hl: "en", gl: "US", ceid: "US:en" },
  zh: { q: "哈萨克斯坦 矿业", hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" },
};
