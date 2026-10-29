"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { contourAreaKm2 } from "@/lib/coords";
import type { Contour } from "@/lib/types";

const text = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function updateCompany(id: number, formData: FormData) {
  const supabase = await createClient();
  const name = text(formData, "name");
  if (!name) throw new Error("Укажите наименование компании");
  const { error } = await supabase
    .from("companies")
    .update({
      name,
      bin: text(formData, "bin"),
      director: text(formData, "director"),
      legal_address: text(formData, "legal_address"),
      contacts: text(formData, "contacts"),
      founders_share: text(formData, "founders_share"),
      notes: text(formData, "notes"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  // keep the denormalised company name on licences in step
  await supabase.from("licenses").update({ company_name: name }).eq("company_id", id);
  revalidatePath("/", "layout");
  redirect(`/companies/${id}`);
}

export async function createCompany(formData: FormData) {
  const supabase = await createClient();
  const name = text(formData, "name");
  if (!name) throw new Error("Укажите наименование компании");
  const { data, error } = await supabase
    .from("companies")
    .insert({ name, bin: text(formData, "bin"), director: text(formData, "director") })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/companies/${data.id}`);
}

function licenseFields(formData: FormData) {
  const area = text(formData, "area_sq_km");
  return {
    license_number: text(formData, "license_number") ?? "",
    issue_date: text(formData, "issue_date"),
    expiry_date: text(formData, "expiry_date"),
    license_type: text(formData, "license_type"),
    category: text(formData, "category"),
    mineral: text(formData, "mineral"),
    deposit_name: text(formData, "deposit_name"),
    region: text(formData, "region"),
    district: text(formData, "district"),
    area_sq_km: area ? Number(area.replace(",", ".")) : null,
    status: text(formData, "status"),
    responsible: text(formData, "responsible"),
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };
}

async function companyName(supabase: Awaited<ReturnType<typeof createClient>>, id: number) {
  const { data } = await supabase.from("companies").select("name").eq("id", id).single();
  return data?.name ?? "";
}

export async function createLicense(formData: FormData) {
  const supabase = await createClient();
  const companyId = Number(formData.get("company_id"));
  if (!companyId) throw new Error("Выберите компанию");
  const fields = licenseFields(formData);
  if (!fields.license_number) throw new Error("Укажите номер лицензии");
  const { data, error } = await supabase
    .from("licenses")
    .insert({ ...fields, company_id: companyId, company_name: await companyName(supabase, companyId) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/licenses/${data.id}?tab=map`);
}

export async function updateLicense(id: number, formData: FormData) {
  const supabase = await createClient();
  const companyId = Number(formData.get("company_id"));
  const fields = licenseFields(formData);
  if (!fields.license_number) throw new Error("Укажите номер лицензии");
  const { error } = await supabase
    .from("licenses")
    .update({ ...fields, company_id: companyId, company_name: await companyName(supabase, companyId) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/licenses/${id}`);
}

export async function saveContour(id: number, contour: Contour | null, source: string) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    contour,
    contour_source: contour ? source : null,
    updated_at: new Date().toISOString(),
  };
  // fill the area from the contour only when no area was entered from the licence itself
  const { data: current } = await supabase.from("licenses").select("area_sq_km").eq("id", id).single();
  if (contour && current && current.area_sq_km == null) {
    const a = contourAreaKm2(contour);
    if (a) patch.area_sq_km = Math.round(a * 100) / 100;
  }
  const { error } = await supabase.from("licenses").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
