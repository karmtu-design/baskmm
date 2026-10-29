// Excel template, import and export for drill holes: sheet «Скважины» (one row per hole)
// and sheet «Интервалы» (one row per sampled interval). Runs in the browser.
import { convertPoint, systemFromText } from "./coords";
import type { Drillhole } from "./types";

const HOLE_COLS = ["Скважина", "Широта", "Долгота", "Система координат", "Отметка устья, м", "Азимут, °", "Угол наклона, °", "Глубина, м", "Год", "Примечания"];
const INT_COLS = ["Скважина", "От, м", "До, м", "Элемент", "Содержание", "Ед. изм.", "Порода"];

export type HoleImport = {
  hole_id: string;
  lon: number;
  lat: number;
  elevation_m: number | null;
  azimuth_deg: number;
  dip_deg: number;
  depth_m: number;
  year: number | null;
  notes: string | null;
  intervals: { from_m: number; to_m: number; element: string | null; grade: number | null; unit: string | null; lithology: string | null }[];
};

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text != null) return String(o.text);
    if (o.result != null) return text(o.result);
    return "";
  }
  return String(v).trim();
}
const num = (v: unknown) => {
  const s = text(v).replace(",", ".").replace(/\s/g, "");
  return s === "" || isNaN(Number(s)) ? null : Number(s);
};
const norm = (s: string) => s.toLowerCase().replace(/[\s,.()°]+/g, " ").trim();
function cols(header: unknown[], wanted: string[]) {
  const h = header.map((x) => norm(text(x)));
  return wanted.map((w) => {
    const first = norm(w).split(" ")[0];
    return h.findIndex((x) => x === norm(w) || x.startsWith(first));
  });
}

export async function readDrillWorkbook(file: File): Promise<{ holes: HoleImport[]; errors: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const errors: string[] = [];
  const hs = wb.worksheets.find((w) => /скваж/i.test(w.name)) ?? wb.worksheets[0];
  const is = wb.worksheets.find((w) => /интерв|проб/i.test(w.name));
  if (!hs) return { holes: [], errors: ["В файле нет листа «Скважины»."] };
  const row = (ws: typeof hs, r: number) => (ws.getRow(r).values as unknown[]).slice(1);

  const [cId, cLat, cLon, cSys, cZ, cAz, cDip, cDepth, cYear, cNotes] = cols(row(hs, 1), HOLE_COLS);
  if (cId < 0 || cLat < 0 || cLon < 0 || cDepth < 0) {
    return { holes: [], errors: ["На листе «Скважины» нужны столбцы «Скважина», «Широта», «Долгота», «Глубина, м»."] };
  }
  const holes = new Map<string, HoleImport>();
  for (let r = 2; r <= hs.rowCount; r++) {
    const v = row(hs, r);
    const id = text(v[cId]);
    if (!id) continue;
    const p = convertPoint(text(v[cLat]), text(v[cLon]), systemFromText(cSys >= 0 ? text(v[cSys]) : ""));
    const depth = num(v[cDepth]);
    if (!p) {
      errors.push(`Скважина ${id}: координаты не читаются.`);
      continue;
    }
    if (!depth || depth <= 0) {
      errors.push(`Скважина ${id}: не указана глубина.`);
      continue;
    }
    const dipRaw = cDip >= 0 ? num(v[cDip]) : null;
    holes.set(id, {
      hole_id: id,
      lon: p[0],
      lat: p[1],
      elevation_m: cZ >= 0 ? num(v[cZ]) : null,
      azimuth_deg: (cAz >= 0 ? num(v[cAz]) : null) ?? 0,
      // dip written as 90 or 60 (positive) is taken as downward
      dip_deg: dipRaw == null ? -90 : -Math.abs(dipRaw),
      depth_m: depth,
      year: cYear >= 0 ? num(v[cYear]) : null,
      notes: cNotes >= 0 ? text(v[cNotes]) || null : null,
      intervals: [],
    });
  }
  if (is) {
    const [iId, iFrom, iTo, iEl, iGr, iUnit, iLith] = cols(row(is, 1), INT_COLS);
    if (iId < 0 || iFrom < 0 || iTo < 0) errors.push("На листе «Интервалы» нужны столбцы «Скважина», «От, м», «До, м».");
    else
      for (let r = 2; r <= is.rowCount; r++) {
        const v = row(is, r);
        const id = text(v[iId]);
        if (!id) continue;
        const h = holes.get(id);
        const from = num(v[iFrom]),
          to = num(v[iTo]);
        if (!h) {
          errors.push(`Интервал в строке ${r}: скважины ${id} нет на листе «Скважины».`);
          continue;
        }
        if (from == null || to == null || to <= from) {
          errors.push(`Скважина ${id}, строка ${r}: неверные глубины «от/до».`);
          continue;
        }
        h.intervals.push({
          from_m: from,
          to_m: to,
          element: iEl >= 0 ? text(v[iEl]) || null : null,
          grade: iGr >= 0 ? num(v[iGr]) : null,
          unit: iUnit >= 0 ? text(v[iUnit]) || null : null,
          lithology: iLith >= 0 ? text(v[iLith]) || null : null,
        });
      }
  }
  return { holes: [...holes.values()], errors };
}

export async function downloadDrillWorkbook(holes: Drillhole[] | null, fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const hs = wb.addWorksheet("Скважины", { views: [{ state: "frozen", ySplit: 1 }] });
  hs.columns = HOLE_COLS.map((h) => ({ header: h, width: Math.max(12, h.length + 4) }));
  const is = wb.addWorksheet("Интервалы", { views: [{ state: "frozen", ySplit: 1 }] });
  is.columns = INT_COLS.map((h) => ({ header: h, width: Math.max(10, h.length + 4) }));
  if (holes?.length) {
    for (const h of holes) {
      hs.addRow([h.hole_id, h.lat, h.lon, "WGS-84", h.elevation_m, h.azimuth_deg, h.dip_deg, h.depth_m, h.year, h.notes]);
      for (const i of h.drill_intervals) is.addRow([h.hole_id, i.from_m, i.to_m, i.element, i.grade, i.unit, i.lithology]);
    }
  } else {
    hs.addRow(["С-1", "49°24'36\"", "75°28'48\"", "WGS-84", 880, 45, -75, 300, 1968, "пример: удалите перед загрузкой"]);
    [
      [0, 10, "Cu", 0.05, "%", "андезит"],
      [10, 20, "Cu", 0.42, "%", "гранодиорит-порфир"],
    ].forEach((r) => is.addRow(["С-1", ...r]));
  }
  [hs, is].forEach((ws) =>
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF101820" } };
    })
  );
  const help = wb.addWorksheet("Как заполнять");
  help.getColumn(1).width = 110;
  [
    "Лист «Скважины»: одна строка на скважину. Координаты устья в градусах-минутах-секундах или десятичных градусах.",
    "Система координат: WGS-84 или СК-42 (пересчёт автоматический).",
    "Угол наклона: −90 или 90 = вертикальная скважина, −60 = наклонная под 60° к горизонту. Азимут: направление в градусах от севера.",
    "Лист «Интервалы»: одна строка на интервал опробования. Номер скважины должен совпадать с листом «Скважины».",
    "Можно указывать несколько элементов (Cu, Mo, Au…): каждый элемент отдельной строкой.",
  ].forEach((t) => help.addRow([t]));
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
