export type Polygon = { type: "Polygon"; coordinates: number[][][] };
export type MultiPolygon = { type: "MultiPolygon"; coordinates: number[][][][] };
export type Contour = Polygon | MultiPolygon;

export type Company = {
  id: number;
  name: string;
  bin: string | null;
  director: string | null;
  legal_address: string | null;
  contacts: string | null;
  founders_share: string | null;
  notes: string | null;
};

export type License = {
  id: number;
  company_id: number | null;
  company_name: string;
  license_number: string;
  issue_date: string | null;
  expiry_date: string | null;
  license_type: string | null;
  category: string | null;
  mineral: string | null;
  deposit_name: string | null;
  region: string | null;
  district: string | null;
  area_sq_km: number | null;
  status: string | null;
  responsible: string | null;
  contour: Contour | null;
  contour_source: string | null;
  notes: string | null;
};

export const LICENSE_TYPES = ["Разведка", "Добыча"];
export const CATEGORIES = ["ТПИ", "ОПИ"];
export const STATUSES = ["действует", "на продлении", "в оформлении", "приостановлена", "истекла"];

/** Colour of a licence on the map, by its main commodity — a geological-legend palette. */
export function mineralColor(mineral: string | null): string {
  const m = (mineral || "").toLowerCase();
  if (m.startsWith("au") || m.includes("золот")) return "#C08A1E";
  if (m.startsWith("li") || m.includes("лит")) return "#7B5EA7";
  if (m.startsWith("cu") || m.includes("мед")) return "#2E7D73";
  if (m.startsWith("w") || m.includes("вольфр") || m.startsWith("mo") || m.startsWith("sn")) return "#4A6A8C";
  if (m.includes("жаде") || m.includes("нефр")) return "#5E8C3A";
  return "#8A5A44";
}

export function mineralGroup(mineral: string | null): string {
  const c = mineralColor(mineral);
  return (
    {
      "#C08A1E": "Золото",
      "#7B5EA7": "Литий",
      "#2E7D73": "Медь",
      "#4A6A8C": "W, Mo, Sn",
      "#5E8C3A": "Поделочные камни",
    } as Record<string, string>
  )[c] ?? "Прочее";
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function isTest(l: Pick<License, "license_number" | "contour_source">) {
  return /тест/i.test(l.license_number) || /тест/i.test(l.contour_source || "");
}

export type DrillInterval = {
  id: number;
  from_m: number;
  to_m: number;
  element: string | null;
  grade: number | null;
  unit: string | null;
  lithology: string | null;
};

export type Drillhole = {
  id: number;
  license_id: number;
  hole_id: string;
  lon: number;
  lat: number;
  elevation_m: number | null;
  azimuth_deg: number | null;
  dip_deg: number | null;
  depth_m: number;
  year: number | null;
  notes: string | null;
  is_test: boolean;
  drill_intervals: DrillInterval[];
};

export type Presentation = {
  id: number;
  title: string;
  project: string | null;
  language: string | null;
  description: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export const PRESENTATION_LANGUAGES = ["Русский", "English", "中文", "Қазақша"];

export type PotentialProject = {
  id: number;
  name: string;
  commodity: string | null;
  region: string | null;
  district: string | null;
  stage: string | null;
  deal_type: string | null;
  holder: string | null;
  source: string | null;
  contact: string | null;
  resources: string | null;
  terms: string | null;
  responsible: string | null;
  next_step: string | null;
  next_date: string | null;
  lat: number | null;
  lon: number | null;
  link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Stages a potential project moves through, in order. */
export const PROJECT_STAGES = ["Новый", "Изучаем", "Переговоры", "Due diligence", "Сделка", "Отложен", "Отклонён"];
export const DEAL_TYPES = ["Покупка доли", "Покупка 100%", "Совместное предприятие", "Новая лицензия", "Партнёрство"];

export type DocKind = "document" | "history";
export type DocumentRow = {
  id: number;
  kind: DocKind;
  license_id: number | null;
  project_id: number | null;
  title: string;
  category: string | null;
  doc_date: string | null;
  year: number | null;
  source: string | null;
  notes: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  pages: number | null;
  text_status: "none" | "done" | "ocr" | "failed" | "unsupported";
  uploaded_by: string | null;
  created_at: string;
};

export const DOC_CATEGORIES = [
  "Лицензия и приложения",
  "Контракт, договор",
  "План разведки / горных работ",
  "Отчёт по обязательствам",
  "Экология",
  "Земля, сервитут",
  "Финансы, налоги",
  "Корпоративные документы",
  "Переписка",
  "Прочее",
];
export const HISTORY_CATEGORIES = [
  "Геологический отчёт",
  "Подсчёт запасов",
  "Протокол ГКЗ / ТКЗ",
  "Геологическая карта",
  "Скважины и пробы",
  "Геофизика",
  "Прочее",
];
