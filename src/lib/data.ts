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
