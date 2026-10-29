// Excel template, import and export for potential projects. Runs in the browser.
import { convertPoint, toDMS } from "./coords";
import { cellText, findColumns, styleHeader, toIsoDate } from "./excel";
import { DEAL_TYPES, PROJECT_STAGES, type PotentialProject } from "./types";

export const PROJECT_COLUMNS = [
  { key: "name", header: "Название проекта", width: 28, required: true },
  { key: "commodity", header: "Полезное ископаемое", width: 20 },
  { key: "region", header: "Область", width: 24 },
  { key: "district", header: "Район", width: 20 },
  { key: "stage", header: "Этап", width: 16 },
  { key: "deal_type", header: "Тип сделки", width: 22 },
  { key: "holder", header: "Владелец / правообладатель", width: 28 },
  { key: "source", header: "Откуда пришёл проект", width: 24 },
  { key: "contact", header: "Контакт", width: 26 },
  { key: "resources", header: "Запасы / ресурсы", width: 30 },
  { key: "terms", header: "Условия / цена", width: 26 },
  { key: "responsible", header: "Ответственный", width: 20 },
  { key: "next_step", header: "Следующий шаг", width: 30 },
  { key: "next_date", header: "Срок следующего шага", width: 16 },
  { key: "lat", header: "Широта", width: 16 },
  { key: "lon", header: "Долгота", width: 16 },
  { key: "link", header: "Ссылка на материалы", width: 30 },
  { key: "notes", header: "Примечания", width: 36 },
] as const;
export type ProjectColKey = (typeof PROJECT_COLUMNS)[number]["key"];

export type ProjectImportRow = {
  line: number;
  values: Partial<Record<ProjectColKey, string | number | null>>;
  errors: string[];
  warnings: string[];
};

export async function readProjectWorkbook(file: File): Promise<{ rows: ProjectImportRow[]; problems: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets.find((w) => /проект/i.test(w.name)) ?? wb.worksheets[0];
  if (!sheet) return { rows: [], problems: ["В файле нет ни одного листа."] };

  const values = (r: number) => (sheet.getRow(r).values as unknown[]).slice(1);
  let headerAt = 1;
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    if (values(r).some((v) => /назван/i.test(cellText(v)))) {
      headerAt = r;
      break;
    }
  }
  const idx = findColumns(values(headerAt), PROJECT_COLUMNS.map((c) => c.header));
  if (idx[0] < 0) return { rows: [], problems: [`На листе «${sheet.name}» нет столбца «Название проекта».`] };

  const stages = new Map(PROJECT_STAGES.map((s) => [s.toLowerCase(), s]));
  const rows: ProjectImportRow[] = [];
  const seen = new Set<string>();
  for (let r = headerAt + 1; r <= sheet.rowCount; r++) {
    const v = values(r);
    const raw = (k: ProjectColKey) => {
      const i = idx[PROJECT_COLUMNS.findIndex((c) => c.key === k)];
      return i < 0 ? undefined : v[i];
    };
    const txt = (k: ProjectColKey) => cellText(raw(k));
    if (PROJECT_COLUMNS.every((c) => !txt(c.key))) continue; // empty line

    const row: ProjectImportRow = { line: r, values: {}, errors: [], warnings: [] };
    for (const c of PROJECT_COLUMNS) {
      if (c.key === "next_date" || c.key === "lat" || c.key === "lon") continue;
      const t = txt(c.key);
      row.values[c.key] = t || null;
    }
    const name = String(row.values.name ?? "");
    if (!name) row.errors.push("Не указано название проекта.");
    else if (seen.has(name.toLowerCase())) row.errors.push("Это название уже встречается выше в файле.");
    else seen.add(name.toLowerCase());

    if (row.values.stage) {
      const s = stages.get(String(row.values.stage).toLowerCase());
      if (s) row.values.stage = s;
      else row.warnings.push(`Этап «${row.values.stage}» не из списка; будет сохранён как есть.`);
    }

    const d = toIsoDate(raw("next_date"));
    if (d === undefined) row.warnings.push(`Срок «${txt("next_date")}» не похож на дату и не будет сохранён.`);
    row.values.next_date = d ?? null;

    const lat = txt("lat"),
      lon = txt("lon");
    if (lat || lon) {
      const p = lat && lon ? convertPoint(lat, lon, "wgs84") : null;
      if (p) {
        row.values.lon = Number(p[0].toFixed(6));
        row.values.lat = Number(p[1].toFixed(6));
      } else row.warnings.push("Координаты не читаются и не будут сохранены.");
    }
    rows.push(row);
  }
  return { rows, problems: rows.length ? [] : ["В файле нет заполненных строк."] };
}

export async function downloadProjectWorkbook(projects: PotentialProject[] | null, fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "BASK Metals and Mining";
  const ws = wb.addWorksheet("Проекты", { views: [{ state: "frozen", ySplit: 1, xSplit: 1 }] });
  ws.columns = PROJECT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const rows =
    projects ??
    ([
      {
        name: "Пример: участок Каратас",
        commodity: "Au",
        region: "Абайская область",
        district: "Аягозский район",
        stage: "Изучаем",
        deal_type: "Покупка доли",
        holder: "ТОО Пример",
        source: "Знакомый геолог",
        contact: "Иванов И.И., +7 700 000 00 00",
        resources: "Au 5 т по категории C2 (ГКЗ 1989)",
        terms: "51% за 2 млн USD",
        responsible: "Алмас",
        next_step: "Запросить геологический отчёт",
        next_date: "2026-12-01",
        lat: 48.123456,
        lon: 79.654321,
        link: null,
        notes: "Это пример: удалите строку перед загрузкой",
      },
    ] as unknown as PotentialProject[]);
  for (const p of rows) {
    ws.addRow({
      ...Object.fromEntries(PROJECT_COLUMNS.map((c) => [c.key, (p as Record<string, unknown>)[c.key] ?? null])),
      next_date: p.next_date ? new Date(p.next_date + "T00:00:00Z") : null,
      lat: p.lat != null ? toDMS(p.lat, "", "").trim() : null,
      lon: p.lon != null ? toDMS(p.lon, "", "").trim() : null,
    });
  }
  ws.getColumn("next_date").numFmt = "dd.mm.yyyy";
  ws.getColumn("resources").alignment = { wrapText: true, vertical: "top" };
  ws.getColumn("notes").alignment = { wrapText: true, vertical: "top" };
  styleHeader(ws.getRow(1));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: PROJECT_COLUMNS.length } };
  const listCol = (key: ProjectColKey, items: string[]) => {
    const col = PROJECT_COLUMNS.findIndex((c) => c.key === key) + 1;
    for (let r = 2; r <= Math.max(300, rows.length + 100); r++)
      ws.getCell(r, col).dataValidation = { type: "list", allowBlank: true, showErrorMessage: false, formulae: [`"${items.join(",")}"`] };
  };
  listCol("stage", PROJECT_STAGES);
  listCol("deal_type", DEAL_TYPES);

  const help = wb.addWorksheet("Как заполнять");
  help.getColumn(1).width = 110;
  [
    "Лист «Проекты»: одна строка на проект. Обязательно только «Название проекта».",
    "Если проект с таким названием уже есть в системе, его данные обновятся (при включённой галочке при загрузке).",
    "Этап и тип сделки выбираются из списка в ячейке, но можно вписать и свой вариант.",
    "Срок следующего шага: дата в формате ДД.ММ.ГГГГ.",
    "Широта и долгота (необязательно): одна точка в центре участка, градусы-минуты-секунды (48°07'24\") или десятичные градусы (48.1234), система WGS-84.",
    "Выгрузку с сайта можно поправить и загрузить обратно: строки сопоставляются по названию проекта.",
  ].forEach((t) => help.addRow([t]));

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
