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
