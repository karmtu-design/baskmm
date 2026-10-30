"use client";

// An investor deck in PowerPoint (PptxGenJS), made from the project card in one click:
// cover, key facts, about, metal in the ground at today's prices, contacts. Internal fields stay out.
import type { PotentialProject } from "./types";
import { toDMS } from "./coords";
import { parseResources } from "./inground";

export type Price = { key: string; symbol: string; price: number; unit: string };

const INK = "101820",
  GOLD = "C9A45C",
  GREY = "6B7178",
  LINE = "DADDE1",
  FONT = "Arial";
const OZ_PER_T = 32150.7466;

const T = {
  ru: {
    kicker: "ИНВЕСТИЦИОННОЕ ПРЕДЛОЖЕНИЕ",
    facts: "Ключевые параметры",
    commodity: "Полезное ископаемое",
    location: "Расположение",
    coords: "Координаты центра",
    deal: "Формат сделки",
    resources: "Запасы и ресурсы",
    terms: "Условия",
    about: "О проекте",
    value: "Металл в недрах по текущим ценам",
    metal: "Металл",
    amount: "Количество",
    price: "Цена",
    gross: "Валовая стоимость",
    total: "Итого",
    valueNote: "Оценка: количество металла × цена LME на дату подготовки. Без учёта извлечения, затрат и категории запасов; не является оценкой стоимости актива.",
    map: "Открыть на карте",
    contacts: "Контакты",
    thanks: "Спасибо за внимание",
    conf: "Конфиденциально. Подготовлено BASK Metals and Mining",
    t: "т",
    noPrice: "нет биржевой цены LME",
  },
  en: {
    kicker: "INVESTMENT OPPORTUNITY",
    facts: "Key facts",
    commodity: "Commodity",
    location: "Location",
    coords: "Centre coordinates",
    deal: "Transaction type",
    resources: "Reserves and resources",
    terms: "Terms",
    about: "About the project",
    value: "Metal in the ground at current prices",
    metal: "Metal",
    amount: "Amount",
    price: "Price",
    gross: "Gross value",
    total: "Total",
    valueNote: "Estimate: contained metal × LME price on the date of preparation. Recovery, costs and reserve category are not included; this is not a valuation of the asset.",
    map: "Open on the map",
    contacts: "Contacts",
    thanks: "Thank you",
    conf: "Confidential. Prepared by BASK Metals and Mining",
    t: "t",
    noPrice: "no LME exchange price",
  },
} as const;

async function dataUrl(path: string): Promise<string | null> {
  try {
    const b = await (await fetch(path)).blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

export async function downloadProjectDeck(p: PotentialProject, lang: "ru" | "en", about: string, prices: Price[]) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const L = T[lang];
  const nf = (v: number, d = 0) => v.toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", { maximumFractionDigits: d });
  const usd = (v: number) => new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
  const date = new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in
  pptx.author = "BASK Metals and Mining";
  pptx.company = "BASK Metals and Mining";
  pptx.title = p.name;
  const logoLight = await dataUrl("/brand/full-light.png");

  pptx.defineSlideMaster({
    title: "BASK",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: GOLD } } },
      { text: { text: L.conf, options: { x: 0.5, y: 7.0, w: 9, h: 0.3, fontFace: FONT, fontSize: 9, color: GREY } } },
    ],
    slideNumber: { x: 12.4, y: 7.0, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 9, color: GREY },
  });
  const heading = (s: ReturnType<typeof pptx.addSlide>, text: string) =>
    s.addText(text, { x: 0.5, y: 0.4, w: 12.3, h: 0.8, fontFace: FONT, fontSize: 28, bold: true, color: INK });

  // 1. cover
  const cover = pptx.addSlide();
  cover.background = { color: INK };
  if (logoLight) cover.addImage({ data: logoLight, x: 0.6, y: 0.5, w: 2.4, h: 1.0, sizing: { type: "contain", w: 2.4, h: 1.0 } });
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 7.38, w: 13.33, h: 0.12, fill: { color: GOLD } });
  cover.addText(L.kicker, { x: 0.6, y: 2.6, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: GOLD, charSpacing: 2 });
  cover.addText(p.name, { x: 0.6, y: 3.0, w: 12, h: 1.3, fontFace: FONT, fontSize: 48, bold: true, color: "FFFFFF", fit: "shrink" });
  const sub = [p.commodity, [p.region, p.district].filter(Boolean).join(", ")].filter(Boolean).join("  ·  ");
  if (sub) cover.addText(sub, { x: 0.6, y: 4.3, w: 12, h: 0.5, fontFace: FONT, fontSize: 20, color: "C8CDD2" });
  cover.addText(`BASK Metals and Mining  ·  ${date}`, { x: 0.6, y: 6.6, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: "9AA1A9" });

  // 2. key facts
  const dms = (v: number, a: string, b: string) => toDMS(v, a, b);
  const coords = p.lat != null && p.lon != null ? `${dms(p.lat, "N", "S")}, ${dms(p.lon, "E", "W")}` : "";
  const rows = (
    [
      [L.commodity, p.commodity ?? ""],
      [L.location, [p.region, p.district].filter(Boolean).join(", ")],
      [L.coords, coords],
      [L.deal, p.deal_type ?? ""],
      [L.resources, p.resources ?? ""],
      [L.terms, p.terms ?? ""],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const facts = pptx.addSlide({ masterName: "BASK" });
  heading(facts, L.facts);
  facts.addTable(
    rows.map(([k, v]) => [
      { text: k, options: { bold: true, color: GREY, fontSize: 13 } },
      { text: v, options: { color: INK, fontSize: 16 } },
    ]),
    { x: 0.5, y: 1.4, w: 12.3, colW: [3.4, 8.9], fontFace: FONT, valign: "middle", border: { type: "solid", pt: 0.75, color: LINE }, rowH: 0.62, margin: 0.12 }
  );
  if (p.lat != null && p.lon != null)
    facts.addText(L.map, {
      x: 0.5,
      y: 6.4,
      w: 4,
      h: 0.35,
      fontFace: FONT,
      fontSize: 12,
      color: "A07A2C",
      hyperlink: { url: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}` },
    });

  // 3. about
  if (about.trim()) {
    const s = pptx.addSlide({ masterName: "BASK" });
    heading(s, L.about);
    s.addText(about.trim(), { x: 0.5, y: 1.4, w: 12.3, h: 5.2, fontFace: FONT, fontSize: 20, color: INK, valign: "top", paraSpaceAfter: 10, fit: "shrink" });
  }

  // 4. metal in the ground
  const amounts = parseResources(p.resources)
    .map((a) => {
      const q = prices.find((x) => x.key === a.key);
      const oz = q && /унц|oz/i.test(q.unit);
      return { a, q, value: q ? (oz ? a.tonnes * OZ_PER_T * q.price : a.tonnes * q.price) : null, oz };
    });
  if (amounts.some((r) => r.q)) {
    const s = pptx.addSlide({ masterName: "BASK" });
    heading(s, L.value);
    const total = amounts.reduce((t, r) => t + (r.value ?? 0), 0);
    const head = [L.metal, L.amount, L.price, L.gross].map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: INK }, fontSize: 13 } }));
    const body = amounts.map((r) => [
      { text: r.a.symbol, options: { bold: true } },
      { text: r.oz ? `${nf(r.a.tonnes, 2)} ${L.t} (${nf((r.a.tonnes * OZ_PER_T) / 1000, 0)} koz)` : `${nf(r.a.tonnes)} ${L.t}` },
      { text: r.q ? `${nf(r.q.price, r.oz ? 2 : 0)} ${r.oz ? "$/oz" : "$/t"}` : L.noPrice, options: { color: r.q ? INK : GREY } },
      { text: r.value != null ? usd(r.value) : "—", options: { bold: true } },
    ]);
    const foot = [{ text: L.total, options: { bold: true } }, { text: "" }, { text: "" }, { text: usd(total), options: { bold: true, color: "A07A2C" } }];
    s.addTable([head, ...body, foot], { x: 0.5, y: 1.5, w: 12.3, colW: [2.2, 3.9, 3.0, 3.2], fontFace: FONT, fontSize: 16, color: INK, border: { type: "solid", pt: 0.75, color: LINE }, rowH: 0.6, margin: 0.12 });
    s.addText(L.valueNote, { x: 0.5, y: 6.1, w: 12.3, h: 0.6, fontFace: FONT, fontSize: 11, color: GREY, italic: true });
  }

  // 5. contacts
  const end = pptx.addSlide();
  end.background = { color: INK };
  if (logoLight) end.addImage({ data: logoLight, x: 5.17, y: 2.0, w: 3.0, h: 1.3, sizing: { type: "contain", w: 3.0, h: 1.3 } });
  end.addText(L.thanks, { x: 0, y: 3.8, w: 13.33, h: 0.8, align: "center", fontFace: FONT, fontSize: 32, bold: true, color: "FFFFFF" });
  end.addText(`${L.contacts}: BASK Metals and Mining`, { x: 0, y: 4.6, w: 13.33, h: 0.5, align: "center", fontFace: FONT, fontSize: 16, color: GOLD });

  await pptx.writeFile({ fileName: `${p.name.replace(/[\\/:*?"<>|]+/g, " ")} — ${lang === "ru" ? "презентация" : "deck"}.pptx` });
}
