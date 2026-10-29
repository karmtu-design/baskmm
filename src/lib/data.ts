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
