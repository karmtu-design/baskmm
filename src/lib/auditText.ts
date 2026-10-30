import { tr } from "@/i18n";
// Turning change-log rows into plain Russian: what object, which field, from what to what.
import type { AuditEntry } from "./types";

export const TABLES: Record<string, { one: string; link: (id: number) => string | null }> = {
  licenses: { one: "лицензия", link: (id) => `/licenses/${id}` },
  companies: { one: "компания", link: (id) => `/companies/${id}` },
  potential_projects: { one: "проект", link: (id) => `/projects/${id}` },
  documents: { one: "документ", link: () => "/documents" },
  presentations: { one: "презентация", link: () => "/presentations" },
  tasks: { one: "задача", link: () => "/tasks" },
  map_overlays: { one: "карта на подложке", link: () => null },
  drillholes: { one: "скважина", link: () => null },
  notes: { one: "заметка", link: () => null },
  boards: { one: "схема", link: () => null },
};

const FIELDS: Record<string, string> = {
  name: "название",
  title: "название",
  deposit_name: "участок",
  license_number: "номер лицензии",
  company_id: "компания",
  company_name: "компания",
  issue_date: "дата выдачи",
  expiry_date: "действует до",
  license_type: "вид",
  category: "категория",
  mineral: "полезное ископаемое",
  commodity: "полезное ископаемое",
  region: "область",
  district: "район",
  area_sq_km: "площадь, км²",
  status: "статус",
  responsible: "ответственный",
  contour: "контур",
  contour_source: "источник контура",
  notes: "примечания",
  bin: "БИН",
  director: "руководитель",
  legal_address: "юридический адрес",
  contacts: "контакты",
  founders_share: "учредители и доля",
  stage: "этап",
  deal_type: "тип сделки",
  holder: "владелец",
  source: "источник",
  contact: "контакт",
  resources: "запасы / ресурсы",
  terms: "условия",
  next_step: "следующий шаг",
  next_date: "срок шага",
  lat: "широта",
  lon: "долгота",
  link: "ссылка",
  description: "описание",
  priority: "важность",
  assignee: "исполнитель",
  due_date: "срок",
  completed_at: "выполнено",
  license_id: "лицензия",
  project_id: "проект",
  language: "язык",
  project: "проект",
  doc_date: "дата документа",
  year: "год",
  text_status: "текст для поиска",
  pages: "страниц",
  opacity: "прозрачность",
  file_name: "файл",
  html: "текст",
  scene: "рисунок",
};

const TASK_STATUS: Record<string, string> = { new: "Новые", in_progress: "В работе", review: "На проверке", done: "Готово" };
const PRIORITY: Record<string, string> = { high: "высокая", normal: "обычная", low: "низкая" };

export function fieldLabel(k: string) {
  return tr(FIELDS[k] ?? k);
}

export function valueText(k: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (k === "contour") return v ? tr("есть") : tr("нет");
  if (k === "status" && typeof v === "string" && TASK_STATUS[v]) return tr(TASK_STATUS[v]);
  if (k === "priority" && typeof v === "string") return tr(PRIORITY[v] ?? v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split("-");
    return `${d}.${m}.${y}`;
  }
  if (typeof v === "boolean") return v ? tr("да") : tr("нет");
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 117)}…` : tr(s); // stored words like «на продлении» are shown translated
}

/** The object's name as it was recorded (works for deleted ones too). */
export function recordName(e: AuditEntry, names: Map<string, string>): string {
  const live = e.record_id != null ? names.get(`${e.table_name}:${e.record_id}`) : undefined;
  if (live) return live;
  const r = e.record ?? {};
  const fromChange = (k: string) => (e.changed?.[k]?.[1] as string | undefined) ?? undefined;
  return String(r.deposit_name || r.name || r.title || r.license_number || r.hole_id || fromChange("title") || fromChange("name") || `№ ${e.record_id ?? "?"}`);
}

export const verb = (e: AuditEntry) => (e.op === "INSERT" ? tr("добавил(а)") : e.op === "DELETE" ? tr("удалил(а)") : tr("изменил(а)"));
