// Rough value of metal in the ground: the amounts written in a project's «Запасы / ресурсы» field
// (e.g. «Cu 120 тыс. т; Au 5 т C2», «Au 1,2 Moz») times today's price. No recovery, costs or category.

import type { MetalQuote } from "./metals";

const OZ_PER_T = 32150.7466;

/** Element symbols and Russian stems → the metal key used for prices. */
const ELEMENTS: [RegExp, string, string][] = [
  [/^(au|золот)/i, "gold", "Au"],
  [/^(ag|серебр)/i, "silver", "Ag"],
  [/^(cu|мед[ьи])/i, "copper", "Cu"],
  [/^(zn|цинк)/i, "zinc", "Zn"],
  [/^(pb|свин)/i, "lead", "Pb"],
  [/^(sn|олов)/i, "tin", "Sn"],
  [/^(ni|никел)/i, "nickel", "Ni"],
  [/^(al|алюмин)/i, "aluminium", "Al"],
  [/^(wo3|w|вольфрам)/i, "tungsten", "W"],
  [/^(mo|молибд)/i, "molybdenum", "Mo"],
  [/^(li2o|li|лити)/i, "lithium", "Li"],
  [/^(sb|сурьм)/i, "antimony", "Sb"],
];

// a number like 1 234,5 or 1.2, then a unit of mass (not a grade like г/т or %)
const AMOUNT = /(\d[\d\s ]*(?:[.,]\d+)?)\s*(млн\.?\s*т(?:онн)?|тыс\.?\s*т(?:онн)?|т(?:онн[аы]?)?|кг|млн\.?\s*унц|тыс\.?\s*унц|унц|mt|kt|t|kg|moz|koz|oz)(?![\w/а-яё])/i;
const WORD = /(?<![a-zа-яё])(wo3|li2o|[a-z]{1,2}|[а-яё]{4,})(?![a-zа-яё])/gi;

export type Amount = { key: string; symbol: string; tonnes: number; text: string };

export function parseResources(text: string | null): Amount[] {
  if (!text) return [];
  const out: Amount[] = [];
  for (const m of text.matchAll(WORD)) {
    const el = ELEMENTS.find(([re]) => re.test(m[1]));
    if (!el) continue;
    const rest = text.slice(m.index! + m[0].length, m.index! + m[0].length + 40);
    const a = rest.match(AMOUNT);
    // the amount must follow the element closely: only spaces, «–», «:», «=», «≈» in between
    if (!a || !/^[\s:=≈~–—-]*$/.test(rest.slice(0, a.index))) continue;
    // «450 тыс. т руды» is the ore, not the metal
    if (/^\s*(руд|ore|горн)/i.test(rest.slice(a.index! + a[0].length))) continue;
    const n = Number(a[1].replace(/[\s ]/g, "").replace(",", "."));
    const u = a[2].toLowerCase().replace(/\s|\./g, "");
    const t =
      /^(млнт|mt)/.test(u) ? n * 1e6
      : /^(тыст|kt)/.test(u) ? n * 1e3
      : /^(кг|kg)/.test(u) ? n / 1e3
      : /^(млнунц|moz)/.test(u) ? (n * 1e6) / OZ_PER_T
      : /^(тысунц|koz)/.test(u) ? (n * 1e3) / OZ_PER_T
      : /^(унц|oz)/.test(u) ? n / OZ_PER_T
      : n;
    if (!(t > 0) || out.some((o) => o.key === el[1])) continue;
    out.push({ key: el[1], symbol: el[2], tonnes: t, text: `${m[0]} ${a[0]}`.replace(/\s+/g, " ").trim() });
  }
  return out;
}

/** $ value of an amount at today's price, or null when there is no price for that metal. */
export function valueOf(a: Amount, quotes: MetalQuote[]): number | null {
  const q = quotes.find((x) => x.key === a.key);
  if (!q) return null;
  return /унц|oz/i.test(q.unit) ? a.tonnes * OZ_PER_T * q.price : a.tonnes * q.price;
}
