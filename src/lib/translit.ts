// Latin spelling of Russian and Kazakh names for the English and Chinese interface,
// and the text used for search (so «karatas» finds «Каратас» and the other way round).
import { currentLocale, tr } from "@/i18n";

// Russian letters in the usual English spelling of Kazakh place names (Yukon, Bayskoe, Karkaralinsky),
// Kazakh letters as in the 2021 Kazakh Latin alphabet
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "ä", ғ: "ğ", қ: "q", ң: "ñ", ө: "ö", ұ: "ū", ү: "ü", һ: "h", і: "ı",
};

/** «Каратас» → «Karatas», «ТОО Байжер» → «TOO Baizher»; text that is already Latin stays as it is. */
export function latin(s: string): string {
  if (!/[а-яёәғқңөұүһі]/i.test(s)) return s;
  // «-ский», «-ный» at the end of a word → «-sky», «-ny»
  s = s.replace(/([иы])й(?![а-яёәғқңөұүһі])/gi, (_, v: string) => (v === v.toUpperCase() ? "Y" : "y")).replace(/ий(?![а-яё])/gi, "y");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const low = c.toLowerCase();
    const m = MAP[low];
    if (m === undefined) {
      out += c;
      continue;
    }
    if (c === low || !m) out += m;
    else {
      // capital: «Ж» → «Zh», but «ЖКО» → «ZHKO» inside an all-capital word
      const next = s[i + 1];
      const allCaps = next && next !== next.toLowerCase();
      out += allCaps ? m.toUpperCase() : m.charAt(0).toUpperCase() + m.slice(1);
    }
  }
  return out;
}

/** Region and district names: known ones translated, the rest spelled in Latin with «Region»/«District». */
export function placeName(s: string): string {
  return s
    .split(/\s*,\s*/)
    .map((part) => {
      const known = tr(part);
      if (known !== part) return known;
      const m = part.match(/^(.+?)\s+(область|обл\.?|район|р-н)$/i);
      if (m) {
        const kind = /^обл/i.test(m[2]) ? tr("{0} область", { 0: latin(m[1]) }) : tr("{0} район", { 0: latin(m[1]) });
        return kind;
      }
      return latin(part);
    })
    .join(", ");
}

/** A name from the database as shown in the interface language (Russian: unchanged). */
export function dn(s: string | null | undefined): string {
  if (!s) return "";
  return currentLocale() === "ru" ? s : latin(s);
}
export function dp(s: string | null | undefined): string {
  if (!s) return "";
  return currentLocale() === "ru" ? s : placeName(s);
}

/** Lower-case text in both scripts, for search. */
export function searchable(s: string): string {
  const low = s.toLowerCase().replace(/ё/g, "е");
  return `${low} ${latin(low)}`;
}
