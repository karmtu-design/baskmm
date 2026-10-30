import { createClient } from "@/lib/supabase/server";
import type { Company, License } from "./types";

export async function getCompanies(): Promise<Company[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("*").order("id");
  if (error) throw new Error(error.message);
  return data as Company[];
}

export async function getCompany(id: number): Promise<Company | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  return data as Company | null;
}

export async function getLicenses(filter?: { companyId?: number }): Promise<License[]> {
  const supabase = await createClient();
  let q = supabase.from("licenses").select("*").order("expiry_date", { ascending: true });
  if (filter?.companyId) q = q.eq("company_id", filter.companyId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as License[];
}

export async function getLicense(id: number): Promise<License | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("licenses").select("*").eq("id", id).maybeSingle();
  return data as License | null;
}

export async function getDrillholes(licenseId: number): Promise<import("./types").Drillhole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drillholes")
    .select("*, drill_intervals(id, from_m, to_m, element, grade, unit, lithology)")
    .eq("license_id", licenseId)
    .order("hole_id");
  if (error) throw new Error(error.message);
  // numeric columns come back as strings; turn them into numbers once here
  return (data ?? []).map((h: any) => ({
    ...h,
    elevation_m: h.elevation_m == null ? null : Number(h.elevation_m),
    azimuth_deg: h.azimuth_deg == null ? null : Number(h.azimuth_deg),
    dip_deg: h.dip_deg == null ? null : Number(h.dip_deg),
    depth_m: Number(h.depth_m),
    drill_intervals: (h.drill_intervals ?? [])
      .map((i: any) => ({ ...i, from_m: Number(i.from_m), to_m: Number(i.to_m), grade: i.grade == null ? null : Number(i.grade) }))
      .sort((a: any, b: any) => a.from_m - b.from_m),
  }));
}

export async function getPresentations(): Promise<import("./types").Presentation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("presentations").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p: any) => ({ ...p, size_bytes: p.size_bytes == null ? null : Number(p.size_bytes) }));
}

const projectNumbers = (p: any) => ({ ...p, lat: p.lat == null ? null : Number(p.lat), lon: p.lon == null ? null : Number(p.lon) });

export async function getProjects(): Promise<import("./types").PotentialProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("potential_projects").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(projectNumbers);
}

export async function getProject(id: number): Promise<import("./types").PotentialProject | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("potential_projects").select("*").eq("id", id).maybeSingle();
  return data ? projectNumbers(data) : null;
}

const DOC_COLUMNS =
  "id, kind, license_id, project_id, title, category, doc_date, year, source, notes, file_path, file_name, mime_type, size_bytes, pages, text_status, uploaded_by, created_at";

/** Documents without their (possibly long) extracted text. */
export async function getDocuments(filter: { licenseId?: number; projectId?: number; kind?: "document" | "history" } = {}) {
  const supabase = await createClient();
  let q = supabase.from("documents").select(DOC_COLUMNS).order("created_at", { ascending: false });
  if (filter.licenseId) q = q.eq("license_id", filter.licenseId);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (filter.kind) q = q.eq("kind", filter.kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((d: any) => ({ ...d, size_bytes: d.size_bytes == null ? null : Number(d.size_bytes) })) as import("./types").DocumentRow[];
}

/** Map pictures (GeoTIFF overlays) of a licence, with short-lived links to the images. */
export async function getOverlays(licenseId: number): Promise<import("./types").MapImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("map_overlays").select("id, title, file_path, corners, opacity, crs").eq("license_id", licenseId).order("created_at");
  if (error || !data?.length) return [];
  const { data: urls } = await supabase.storage.from("documents").createSignedUrls(data.map((d) => d.file_path), 3600);
  return data.map((d, i) => ({ id: d.id, title: d.title, url: urls?.[i]?.signedUrl ?? "", corners: d.corners, opacity: Number(d.opacity), crs: d.crs })).filter((d) => d.url);
}

/**
 * Tasks, after making sure every licence that expires within 90 days has its renewal task
 * (created once per licence and expiry date; a task already closed is not reopened).
 */
export async function getTasks(filter: { licenseId?: number; projectId?: number } = {}): Promise<import("./types").Task[]> {
  const supabase = await createClient();
  const { data: lic } = await supabase.from("licenses").select("id, deposit_name, license_number, expiry_date, status, responsible");
  const today = new Date();
  const auto = (lic ?? [])
    .filter((l) => l.expiry_date && l.status !== "истекла")
    .map((l) => ({ l, days: Math.ceil((new Date(l.expiry_date + "T00:00:00").getTime() - today.getTime()) / 86400000) }))
    .filter(({ days }) => days <= 90 && days > -30)
    .map(({ l, days }) => {
      const due = new Date(new Date(l.expiry_date + "T00:00:00").getTime() - 30 * 86400000);
      const dueIso = (due < today ? today : due).toISOString().slice(0, 10);
      const [y, m, d] = l.expiry_date.split("-");
      return {
        title: `Продление лицензии ${l.deposit_name || l.license_number}: срок до ${d}.${m}.${y}`,
        description: `Задача создана автоматически: ${days >= 0 ? `до окончания срока лицензии осталось ${days} дн.` : `срок лицензии истёк ${-days} дн. назад`} Проверьте с юристом сроки подачи заявления на продление.`,
        priority: "high",
        assignee: l.responsible,
        due_date: dueIso,
        license_id: l.id,
        auto_key: `expiry:${l.id}:${l.expiry_date}`,
        created_by: "система",
      };
    });
  if (auto.length) await supabase.from("tasks").upsert(auto, { onConflict: "auto_key", ignoreDuplicates: true });

  let q = supabase.from("tasks").select("*").order("position").order("id");
  if (filter.licenseId) q = q.eq("license_id", filter.licenseId);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as import("./types").Task[];
}

/** Stored daily metal prices (oldest first), for the price history chart. */
export async function getMetalHistory(): Promise<{ metal: string; price_date: string; price: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("metal_prices").select("metal, price_date, price").order("price_date").limit(5000);
  return (data ?? []).map((r) => ({ ...r, price: Number(r.price) }));
}

/** Change log, newest first; optionally of one table/record, and older than a given id (paging). */
export async function getAudit(f: { table?: string; recordId?: number; before?: number; limit?: number; actor?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("audit_log").select("id, ts, table_name, record_id, op, actor_email, changed, record").order("id", { ascending: false }).limit(f.limit ?? 100);
  if (f.table) q = q.eq("table_name", f.table);
  if (f.recordId) q = q.eq("record_id", f.recordId);
  if (f.before) q = q.lt("id", f.before);
  if (f.actor) q = q.eq("actor_email", f.actor);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as import("./types").AuditEntry[];
}

/** Current names of the objects mentioned in the log, so links show today's names. */
export async function getAuditNames(entries: { table_name: string; record_id: number | null }[]) {
  const supabase = await createClient();
  const by = new Map<string, number[]>();
  for (const e of entries) if (e.record_id != null) by.set(e.table_name, [...(by.get(e.table_name) ?? []), e.record_id]);
  const cols: Record<string, string> = {
    licenses: "id, deposit_name, license_number",
    companies: "id, name",
    potential_projects: "id, name",
    documents: "id, title",
    presentations: "id, title",
    tasks: "id, title",
    map_overlays: "id, title",
    drillholes: "id, hole_id",
  };
  const names = new Map<string, string>();
  await Promise.all(
    [...by].map(async ([table, ids]) => {
      if (!cols[table]) return;
      const { data } = await supabase.from(table).select(cols[table]).in("id", [...new Set(ids)]);
      for (const r of (data ?? []) as unknown as Record<string, unknown>[])
        names.set(`${table}:${r.id}`, String(r.deposit_name || r.name || r.title || r.license_number || r.hole_id || r.id));
    })
  );
  return names;
}

/** Official tenge rates of the National Bank of Kazakhstan for today (their RSS page; no key needed). */
export async function getRates(): Promise<import("./feeds").Rates | null> {
  const { parseRates } = await import("./feeds");
  const now = new Date(Date.now() + 5 * 3600e3); // Kazakhstan time
  const d = `${String(now.getUTCDate()).padStart(2, "0")}.${String(now.getUTCMonth() + 1).padStart(2, "0")}.${now.getUTCFullYear()}`;
  // the dated page first; the "all rates" page as a fallback (same format)
  for (const url of [`https://nationalbank.kz/rss/get_rates.cfm?fdate=${d}`, "https://nationalbank.kz/rss/rates_all.xml"]) {
    try {
      const res = await fetch(url, { next: { revalidate: 3 * 3600 }, signal: AbortSignal.timeout(8000) });
      const r = res.ok ? parseRates(await res.text(), d) : null;
      if (r) return r;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/** A few fresh industry headlines from Google News, in the interface language (no key needed). */
export async function getNews(lang: string): Promise<import("./feeds").NewsItem[] | null> {
  const { parseNews, NEWS_QUERY } = await import("./feeds");
  const q = NEWS_QUERY[lang] ?? NEWS_QUERY.ru;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q.q + " when:14d")}&hl=${q.hl}&gl=${q.gl}&ceid=${q.ceid}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3 * 3600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return parseNews(await res.text(), 6);
  } catch {
    return null;
  }
}
