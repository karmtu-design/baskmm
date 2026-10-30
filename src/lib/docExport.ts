// One-click documents made in the browser: a licence summary in Word (docx) and a one-page project
// teaser in PDF (pdf-lib, PT Sans for Cyrillic). Nothing is sent anywhere; the file is downloaded.
"use client";

import { contourCorners, toDMS } from "./coords";
import { daysUntil, formatDate, type License, type PotentialProject } from "./types";

const GOLD = "C9A45C";
const INK = "101820";

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]+/g, " ").trim();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const today = () => new Date().toLocaleDateString("ru-RU");
const bytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

// ---------- licence summary (Word) ----------

export type LicenseExtras = {
  docs: { title: string; category: string | null; doc_date: string | null; year: number | null }[];
  tasks: { title: string; assignee: string | null; due_date: string | null }[];
};

export async function downloadLicenseDocx(l: License, extras: LicenseExtras) {
  const d = await import("docx");
  const { AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = d;
  const font = "Arial";
  const thin = { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" };
  const borders = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };
  const cell = (text: string, opts: { bold?: boolean; head?: boolean; width?: number } = {}) =>
    new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.head ? { type: ShadingType.CLEAR, color: "auto", fill: "F3EFE6" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold || opts.head, font, size: 20 })] })],
    });
  const kv = (rows: [string, string][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: rows.map(([k, v]) => new TableRow({ children: [cell(k, { head: true, width: 35 }), cell(v || "—", { width: 65 })] })),
    });
  const h = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 }, children: [new TextRun({ text, font, bold: true, size: 26, color: INK })] });
  const p = (text: string, o: { size?: number; color?: string; italics?: boolean } = {}) =>
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, font, size: o.size ?? 20, color: o.color, italics: o.italics })] });

  const days = daysUntil(l.expiry_date);
  const facts: [string, string][] = [
    ["Компания-недропользователь", l.company_name],
    ["Номер лицензии", l.license_number],
    ["Вид лицензии", [l.license_type, l.category].filter(Boolean).join(", ")],
    ["Полезное ископаемое", l.mineral ?? ""],
    ["Расположение", [l.region, l.district].filter(Boolean).join(", ")],
    ["Дата выдачи", formatDate(l.issue_date)],
    ["Действует до", `${formatDate(l.expiry_date)}${days != null ? (days < 0 ? ` (истекла ${-days} дн. назад)` : ` (осталось ${days} дн.)`) : ""}`],
    ["Площадь по лицензии", l.area_sq_km != null ? `${l.area_sq_km.toLocaleString("ru-RU")} км²` : ""],
    ["Статус", l.status ?? ""],
    ["Ответственный", l.responsible ?? ""],
  ];

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  try {
    children.push(new Paragraph({ children: [new ImageRun({ type: "png", data: await bytes("/brand/full-dark.png"), transformation: { width: 150, height: 70 } })] }));
  } catch {
    /* the logo is decoration */
  }
  children.push(
    new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: "СПРАВКА ПО ЛИЦЕНЗИИ", font, size: 18, bold: true, color: GOLD, characterSpacing: 40 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: l.deposit_name || l.license_number, font, size: 40, bold: true, color: INK })] }),
    kv(facts)
  );
  if (l.notes) children.push(h("Примечания"), p(l.notes));

  if (l.contour) {
    const pts = contourCorners(l.contour);
    children.push(
      h("Угловые точки контура (WGS-84)"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: [
          new TableRow({ children: [cell("№", { head: true, width: 10 }), cell("Северная широта", { head: true, width: 45 }), cell("Восточная долгота", { head: true, width: 45 })] }),
          ...pts.map(([lon, lat], i) => new TableRow({ children: [cell(String(i + 1)), cell(toDMS(lat, "", "")), cell(toDMS(lon, "", ""))] })),
        ],
      })
    );
  }

  children.push(h("Документы в системе"));
  if (extras.docs.length)
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: [
          new TableRow({ children: [cell("Документ", { head: true, width: 55 }), cell("Категория", { head: true, width: 30 }), cell("Дата", { head: true, width: 15 })] }),
          ...extras.docs.map((x) => new TableRow({ children: [cell(x.title), cell(x.category ?? "—"), cell(x.doc_date ? formatDate(x.doc_date) : x.year ? String(x.year) : "—")] })),
        ],
      })
    );
  else children.push(p("Документы по лицензии пока не загружены.", { italics: true, color: "777777" }));

  children.push(h("Открытые задачи"));
  if (extras.tasks.length)
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        rows: [
          new TableRow({ children: [cell("Задача", { head: true, width: 60 }), cell("Исполнитель", { head: true, width: 25 }), cell("Срок", { head: true, width: 15 })] }),
          ...extras.tasks.map((x) => new TableRow({ children: [cell(x.title), cell(x.assignee ?? "—"), cell(formatDate(x.due_date))] })),
        ],
      })
    );
  else children.push(p("Открытых задач нет.", { italics: true, color: "777777" }));

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 400 },
      children: [new TextRun({ text: `Сформировано в системе BASK Metals and Mining ${today()}. Данные на момент выгрузки.`, font, size: 16, color: "888888" })],
    })
  );

  const doc = new Document({
    creator: "BASK Metals and Mining",
    title: `Справка по лицензии ${l.license_number}`,
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children }],
  });
  save(await Packer.toBlob(doc), `Справка ${l.deposit_name || l.license_number}.docx`);
}

// ---------- project teaser (PDF) ----------

const LABELS = {
  ru: {
    kicker: "ИНВЕСТИЦИОННОЕ ПРЕДЛОЖЕНИЕ",
    commodity: "Полезное ископаемое",
    location: "Расположение",
    coords: "Координаты центра",
    deal: "Формат сделки",
    resources: "Запасы и ресурсы",
    terms: "Условия",
    about: "О проекте",
    confidential: "Конфиденциально. Подготовлено BASK Metals and Mining",
  },
  en: {
    kicker: "INVESTMENT OPPORTUNITY",
    commodity: "Commodity",
    location: "Location",
    coords: "Centre coordinates",
    deal: "Transaction type",
    resources: "Reserves and resources",
    terms: "Terms",
    about: "About the project",
    confidential: "Confidential. Prepared by BASK Metals and Mining",
  },
} as const;

/**
 * A one-page teaser. Internal fields (owner, contact, source, responsible, stage) are left out on purpose:
 * the teaser is meant to be sent outside the group.
 */
export async function downloadProjectTeaser(p: PotentialProject, lang: "ru" | "en", about?: string) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const L = LABELS[lang];
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${p.name} — ${lang === "ru" ? "тизер" : "teaser"}`);
  pdf.setAuthor("BASK Metals and Mining");
  const regular = await pdf.embedFont(await bytes("/vendor/fonts/PTSans-Regular.ttf"));
  const bold = await pdf.embedFont(await bytes("/vendor/fonts/PTSans-Bold.ttf"));
  const page = pdf.addPage([595.28, 841.89]);
  const W = page.getWidth(),
    H = page.getHeight(),
    M = 48;
  const ink = rgb(0x10 / 255, 0x18 / 255, 0x20 / 255);
  const gold = rgb(0xc9 / 255, 0xa4 / 255, 0x5c / 255);
  const grey = rgb(0.42, 0.44, 0.47);
  const line = rgb(0.86, 0.86, 0.86);

  // header band with the logo
  page.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: ink });
  try {
    const logo = await pdf.embedPng(await bytes("/brand/full-light.png"));
    const lw = 150,
      lh = (logo.height / logo.width) * lw;
    page.drawImage(logo, { x: M, y: H - 75 - lh / 2, width: lw, height: lh });
  } catch {
    page.drawText("BASK METALS AND MINING", { x: M, y: H - 80, size: 18, font: bold, color: rgb(1, 1, 1) });
  }
  const kick = L.kicker;
  page.drawText(kick, { x: W - M - bold.widthOfTextAtSize(kick, 9), y: H - 80, size: 9, font: bold, color: gold });
  page.drawRectangle({ x: 0, y: H - 153, width: W, height: 3, color: gold });

  // wraps text to a width; returns the lines
  const wrap = (text: string, font: typeof regular, size: number, width: number) => {
    const out: string[] = [];
    for (const para of text.split(/\n+/)) {
      let cur = "";
      for (const word of para.split(/\s+/)) {
        const next = cur ? `${cur} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && cur) {
          out.push(cur);
          cur = word;
        } else cur = next;
      }
      if (cur) out.push(cur);
    }
    return out;
  };

  let y = H - 200;
  for (const t of wrap(p.name, bold, 28, W - 2 * M)) {
    page.drawText(t, { x: M, y, size: 28, font: bold, color: ink });
    y -= 34;
  }
  const sub = [p.commodity, [p.region, p.district].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  if (sub) {
    page.drawText(sub, { x: M, y: y + 4, size: 12, font: regular, color: grey });
    y -= 30;
  }

  // PT Sans has no prime marks (′ ″): plain apostrophe and quote instead
  const dms = (v: number, a: string, b: string) => toDMS(v, a, b).replace("′", "'").replace("″", '"');
  const coords = p.lat != null && p.lon != null ? `${dms(p.lat, "N", "S")}, ${dms(p.lon, "E", "W")}` : "";
  const rows: [string, string][] = (
    [
      [L.commodity, p.commodity ?? ""],
      [L.location, [p.region, p.district].filter(Boolean).join(", ")],
      [L.coords, coords],
      [L.deal, p.deal_type ?? ""],
      [L.resources, p.resources ?? ""],
      [L.terms, p.terms ?? ""],
    ] as [string, string][]
  ).filter(([, v]) => v);

  const labelW = 150;
  for (const [k, v] of rows) {
    const lines = wrap(v, regular, 11, W - 2 * M - labelW);
    const h = Math.max(1, lines.length) * 15 + 14;
    if (y - h < 120) break;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: line });
    page.drawText(k, { x: M, y: y - 10, size: 9.5, font: bold, color: grey });
    lines.forEach((t, i) => page.drawText(t, { x: M + labelW, y: y - 10 - i * 15, size: 11, font: regular, color: ink }));
    y -= h;
  }
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: line });

  if (about?.trim()) {
    y -= 22;
    page.drawText(L.about, { x: M, y, size: 13, font: bold, color: ink });
    y -= 20;
    for (const t of wrap(about.trim(), regular, 11, W - 2 * M)) {
      if (y < 110) break;
      page.drawText(t, { x: M, y, size: 11, font: regular, color: ink });
      y -= 16;
    }
  }

  // footer
  page.drawRectangle({ x: M, y: 70, width: 40, height: 2, color: gold });
  page.drawText(`${L.confidential}, ${today()}`, { x: M, y: 54, size: 8.5, font: regular, color: grey });

  const out = await pdf.save();
  save(new Blob([out.slice().buffer], { type: "application/pdf" }), `${lang === "ru" ? "Тизер" : "Teaser"} ${p.name}.pdf`);
}
