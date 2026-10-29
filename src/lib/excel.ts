// Excel import and export of the licence register. Runs in the browser; the Excel library is
// loaded only when someone presses an Excel button, so ordinary pages stay light.
import { contourCorners, convertPoint, pointsToPolygon, systemFromText, toDMS } from "./coords";
import { CATEGORIES, LICENSE_TYPES, STATUSES, type Contour, type License } from "./types";

/** Columns of the «Лицензии» sheet: the same in the template, the export and the import. */
export const LICENSE_COLUMNS = [
  { key: "company_name", header: "Компания", width: 30, required: true },
  { key: "license_number", header: "Номер лицензии", width: 22, required: true },
  { key: "deposit_name", header: "Участок / месторождение", width: 28 },
  { key: "license_type", header: "Вид (Разведка / Добыча)", width: 22 },
  { key: "category", header: "Категория (ТПИ / ОПИ)", width: 20 },
  { key: "mineral", header: "Полезное ископаемое", width: 20 },
  { key: "region", header: "Область", width: 24 },
  { key: "district", header: "Район", width: 20 },
  { key: "issue_date", header: "Дата выдачи", width: 14 },
  { key: "expiry_date", header: "Действует до", width: 14 },
  { key: "area_sq_km", header: "Площадь, км²", width: 13 },
  { key: "status", header: "Статус", width: 16 },
  { key: "responsible", header: "Ответственный", width: 20 },
  { key: "notes", header: "Примечания", width: 36 },
] as const;
type ColKey = (typeof LICENSE_COLUMNS)[number]["key"];

const POINT_COLUMNS = ["Номер лицензии", "Точка", "Широта", "Долгота", "Система координат"];

export type ImportRow = {
  line: number; // row number in the Excel sheet
  values: Partial<Record<ColKey, string | number | null>>;
  contour: Contour | null;
  errors: string[];
  warnings: string[];
};

// ---------- reading cells ----------

export function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text != null) return String(o.text);
    if (o.result != null) return cellText(o.result);
    return "";
  }
  return String(v).trim();
}

/** Dates as typed in Excel: a real date cell, 31.12.2028, 2028-12-31 or an Excel day number. */
export function toIsoDate(v: unknown): string | null | undefined {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime()))
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return toIsoDate(d);
  }
  const s = cellText(v);
  const real = (y: string, mo: string, d: string) => {
    const t = new Date(Date.UTC(+y, +mo - 1, +d));
    return t.getUTCFullYear() === +y && t.getUTCMonth() === +mo - 1 && t.getUTCDate() === +d
      ? `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
      : undefined;
  };
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return real(m[3], m[2], m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return real(m[1], m[2], m[3]);
  return undefined; // not readable
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[\s,.()/]+/g, " ").trim();

export function findColumns(headerRow: unknown[], wanted: string[]): number[] {
  const heads = headerRow.map((h) => norm(cellText(h)));
  return wanted.map((w) => {
    const n = norm(w);
    const first = n.split(" ")[0];
    let i = heads.findIndex((h) => h === n);
    if (i < 0) i = heads.findIndex((h) => h.length >= 3 && (n.startsWith(h) || h.startsWith(n)));
    if (i < 0) i = heads.findIndex((h) => h.startsWith(first) && first.length > 3);
    return i;
  });
}

// ---------- import ----------

export async function readLicenseWorkbook(file: File): Promise<{ rows: ImportRow[]; problems: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const problems: string[] = [];

  const sheet = wb.worksheets.find((w) => /лиценз/i.test(w.name)) ?? wb.worksheets[0];
  if (!sheet) return { rows: [], problems: ["В файле нет ни одного листа."] };

  const values = (r: number) => (sheet.getRow(r).values as unknown[]).slice(1);
  // header = the first row in the top ten that names «Номер лицензии»
  let headerAt = 1;
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    if (values(r).some((v) => /номер\s+лиценз/i.test(cellText(v)))) {
      headerAt = r;
      break;
    }
  }
  const idx = findColumns(values(headerAt), LICENSE_COLUMNS.map((c) => c.header));
  LICENSE_COLUMNS.forEach((c, i) => {
    if ("required" in c && c.required && idx[i] < 0) problems.push(`На листе «${sheet.name}» нет столбца «${c.header}».`);
  });
  if (problems.length) return { rows: [], problems };

  // corner points from the «Координаты» sheet, grouped by licence number
  const points = new Map<string, { n: number; p: [number, number] | null; raw: string }[]>();
  const ptSheet = wb.worksheets.find((w) => /координ|точк/i.test(w.name));
  if (ptSheet) {
    const pv = (r: number) => (ptSheet.getRow(r).values as unknown[]).slice(1);
    const [cNum, cPt, cLat, cLon, cSys] = findColumns(pv(1), POINT_COLUMNS);
    if (cNum < 0 || cLat < 0 || cLon < 0) {
      problems.push("На листе с координатами нужны столбцы «Номер лицензии», «Широта», «Долгота».");
    } else {
      for (let r = 2; r <= ptSheet.rowCount; r++) {
        const v = pv(r);
        const num = cellText(v[cNum]);
        if (!num) continue;
        const lat = cellText(v[cLat]);
        const lon = cellText(v[cLon]);
        const p = convertPoint(lat, lon, systemFromText(cSys >= 0 ? cellText(v[cSys]) : ""));
        const list = points.get(num) ?? [];
        list.push({ n: cPt >= 0 ? Number(cellText(v[cPt])) || list.length + 1 : list.length + 1, p, raw: `${lat} ${lon}` });
        points.set(num, list);
      }
    }
  }

  const rows: ImportRow[] = [];
  for (let r = headerAt + 1; r <= sheet.rowCount; r++) {
    const v = values(r);
    const get = (k: ColKey) => {
      const i = idx[LICENSE_COLUMNS.findIndex((c) => c.key === k)];
      return i >= 0 ? v[i] : undefined;
    };
    if (LICENSE_COLUMNS.every((c) => !cellText(get(c.key)))) continue; // empty line
    const row: ImportRow = { line: r, values: {}, contour: null, errors: [], warnings: [] };
    const t = (k: ColKey) => cellText(get(k)) || null;

    row.values.company_name = t("company_name");
    row.values.license_number = t("license_number");
    if (!row.values.company_name) row.errors.push("не указана компания");
    if (!row.values.license_number) row.errors.push("не указан номер лицензии");
    for (const k of ["deposit_name", "mineral", "region", "district", "responsible", "notes"] as const) row.values[k] = t(k);

    const type = norm(t("license_type") ?? "");
    row.values.license_type = !type ? "Разведка" : type.startsWith("разв") ? "Разведка" : type.startsWith("доб") ? "Добыча" : null;
    if (row.values.license_type == null) row.errors.push(`вид «${t("license_type")}»: нужно ${LICENSE_TYPES.join(" или ")}`);
    if (!type) row.warnings.push("вид не указан, поставлено «Разведка»");

    const cat = (t("category") ?? "").toUpperCase();
    row.values.category = CATEGORIES.includes(cat) ? cat : "ТПИ";
    if (cat && !CATEGORIES.includes(cat)) row.warnings.push(`категория «${cat}» заменена на ТПИ`);

    const st = norm(t("status") ?? "");
    row.values.status = STATUSES.find((s) => norm(s) === st) ?? "действует";
    if (st && !STATUSES.find((s) => norm(s) === st)) row.warnings.push(`статус «${t("status")}» заменён на «действует»`);

    for (const k of ["issue_date", "expiry_date"] as const) {
      const d = toIsoDate(get(k));
      if (d === undefined) row.errors.push(`дата «${cellText(get(k))}» не читается, нужно ДД.ММ.ГГГГ`);
      row.values[k] = d ?? null;
    }

    const area = cellText(get("area_sq_km")).replace(",", ".");
    if (area && isNaN(Number(area))) row.errors.push(`площадь «${area}» не число`);
    row.values.area_sq_km = area && !isNaN(Number(area)) ? Number(area) : null;

    const pts = row.values.license_number ? points.get(String(row.values.license_number)) : undefined;
    if (pts) {
      const bad = pts.filter((p) => !p.p);
      if (bad.length) row.errors.push(`координаты не читаются: ${bad.slice(0, 2).map((b) => b.raw).join("; ")}`);
      else {
        const poly = pointsToPolygon(pts.sort((a, b) => a.n - b.n).map((p) => p.p!));
        if (poly) row.contour = poly;
        else row.errors.push("для контура нужно не меньше трёх точек");
      }
    }
    rows.push(row);
  }

  const known = new Set(rows.map((r) => String(r.values.license_number)));
  const orphan = [...points.keys()].filter((k) => !known.has(k));
  if (orphan.length) problems.push(`Координаты для лицензий, которых нет на листе «Лицензии»: ${orphan.join(", ")}.`);
  const dup = rows.map((r) => r.values.license_number).filter((n, i, a) => n && a.indexOf(n) !== i);
  if (dup.length) problems.push(`Номера встречаются дважды: ${[...new Set(dup)].join(", ")}. Будет записана последняя строка.`);

  return { rows, problems };
}

// ---------- export and template ----------

export async function downloadLicenseWorkbook(licenses: License[] | null, fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "BASK Metals and Mining";

  const ws = wb.addWorksheet("Лицензии", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = LICENSE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const rows: License[] =
    licenses ??
    ([
      {
        company_name: "ТОО Пример",
        license_number: "1234-EL",
        deposit_name: "Участок Пример",
        license_type: "Разведка",
        category: "ТПИ",
        mineral: "Cu",
        region: "Карагандинская область",
        district: "Каркаралинский район",
        issue_date: "2025-03-01",
        expiry_date: "2031-03-01",
        area_sq_km: 12.5,
        status: "действует",
        responsible: "Иванов И.И.",
        notes: "Это пример: удалите строку перед загрузкой",
      },
    ] as unknown as License[]);
  for (const l of rows) {
    ws.addRow({
      ...Object.fromEntries(LICENSE_COLUMNS.map((c) => [c.key, (l as Record<string, unknown>)[c.key] ?? null])),
      issue_date: l.issue_date ? new Date(l.issue_date + "T00:00:00Z") : null,
      expiry_date: l.expiry_date ? new Date(l.expiry_date + "T00:00:00Z") : null,
    });
  }
  ws.getColumn("issue_date").numFmt = "dd.mm.yyyy";
  ws.getColumn("expiry_date").numFmt = "dd.mm.yyyy";
  styleHeader(ws.getRow(1));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: LICENSE_COLUMNS.length } };
  // drop-down lists for the closed sets
  const listCol = (key: ColKey, items: string[]) => {
    const col = LICENSE_COLUMNS.findIndex((c) => c.key === key) + 1;
    for (let r = 2; r <= Math.max(200, rows.length + 50); r++)
      ws.getCell(r, col).dataValidation = { type: "list", allowBlank: true, formulae: [`"${items.join(",")}"`] };
  };
  listCol("license_type", LICENSE_TYPES);
  listCol("category", CATEGORIES);
  listCol("status", STATUSES);

  const ps = wb.addWorksheet("Координаты", { views: [{ state: "frozen", ySplit: 1 }] });
  ps.columns = POINT_COLUMNS.map((h, i) => ({ header: h, width: [22, 8, 20, 20, 20][i] }));
  if (licenses) {
    for (const l of licenses) {
      if (!l.contour) continue;
      contourCorners(l.contour).forEach(([x, y], i) =>
        ps.addRow([l.license_number, i + 1, toDMS(y, "", "").trim(), toDMS(x, "", "").trim(), "WGS-84"])
      );
    }
  } else {
    [
      ["49°37'12\"", "80°31'05\""],
      ["49°38'40\"", "80°34'10\""],
      ["49°36'05\"", "80°35'30\""],
      ["49°35'20\"", "80°32'00\""],
    ].forEach(([lat, lon], i) => ps.addRow(["1234-EL", i + 1, lat, lon, "WGS-84"]));
  }
  styleHeader(ps.getRow(1));
  for (let r = 2; r <= 500; r++) ps.getCell(r, 5).dataValidation = { type: "list", allowBlank: true, formulae: ['"WGS-84,СК-42"'] };

  const help = wb.addWorksheet("Как заполнять");
  help.getColumn(1).width = 110;
  [
    "Лист «Лицензии»: одна строка на лицензию. Обязательны «Компания» и «Номер лицензии».",
    "Если компании ещё нет в системе, она будет создана по названию из этого столбца.",
    "Если лицензия с таким номером уже есть, её данные обновятся (при включённой галочке при загрузке).",
    "Даты: в формате ДД.ММ.ГГГГ. Вид, категория и статус выбираются из списка в ячейке.",
    "Лист «Координаты»: одна строка на угловую точку. Номер лицензии должен совпадать с листом «Лицензии».",
    "Широта и долгота: градусы-минуты-секунды (49°37'12\") или десятичные градусы (49.62).",
    "Система координат: WGS-84 для современных лицензий, СК-42 для старых документов (пересчёт автоматический).",
    "Если координат у лицензии нет, просто не добавляйте её на этот лист: контур можно внести позже.",
  ].forEach((t) => help.addRow([t]));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function styleHeader(row: { font?: unknown; fill?: unknown; eachCell: (fn: (c: any) => void) => void; height?: number }) {
  row.eachCell((c: any) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF101820" } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 30;
}
