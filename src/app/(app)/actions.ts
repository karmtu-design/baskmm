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

export type LicenseImportItem = {
  company_name: string;
  license_number: string;
  deposit_name: string | null;
  license_type: string | null;
  category: string | null;
  mineral: string | null;
  region: string | null;
  district: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  area_sq_km: number | null;
  status: string | null;
  responsible: string | null;
  notes: string | null;
  contour: Contour | null;
};

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  companiesCreated: string[];
  errors: string[];
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Writes rows checked in the browser. Missing companies are created by name; existing licence numbers are updated or skipped. */
export async function importLicenses(items: LicenseImportItem[], updateExisting: boolean): Promise<ImportResult> {
  const supabase = await createClient();
  const res: ImportResult = { ok: true, created: 0, updated: 0, skipped: 0, companiesCreated: [], errors: [] };
  if (!Array.isArray(items) || items.length === 0) return { ...res, ok: false, errors: ["Нет строк для загрузки."] };
  if (items.length > 2000) return { ...res, ok: false, errors: ["За один раз можно загрузить до 2000 строк."] };

  const { data: companies, error: cErr } = await supabase.from("companies").select("id, name");
  if (cErr) return { ...res, ok: false, errors: [cErr.message] };
  const key = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[«»"']/g, "").replace(/\s+/g, " ").trim();
  const byName = new Map(companies.map((c) => [key(c.name), c as { id: number; name: string }]));

  const { data: existing, error: lErr } = await supabase.from("licenses").select("id, license_number, area_sq_km");
  if (lErr) return { ...res, ok: false, errors: [lErr.message] };
  const byNumber = new Map(existing.map((l) => [l.license_number.trim(), l]));

  for (const it of items) {
    const number = String(it.license_number ?? "").trim();
    const companyName = String(it.company_name ?? "").trim();
    if (!number || !companyName) {
      res.errors.push(`Строка без номера или компании пропущена.`);
      res.skipped++;
      continue;
    }
    let company = byName.get(key(companyName));
    if (!company) {
      const { data, error } = await supabase.from("companies").insert({ name: companyName }).select("id, name").single();
      if (error) {
        res.errors.push(`${number}: не удалось создать компанию «${companyName}»: ${error.message}`);
        res.skipped++;
        continue;
      }
      company = data;
      byName.set(key(companyName), data);
      res.companiesCreated.push(companyName);
    }
    const row: Record<string, unknown> = {
      company_id: company.id,
      company_name: company.name,
      license_number: number,
      deposit_name: it.deposit_name,
      license_type: it.license_type,
      category: it.category,
      mineral: it.mineral,
      region: it.region,
      district: it.district,
      issue_date: it.issue_date && ISO.test(it.issue_date) ? it.issue_date : null,
      expiry_date: it.expiry_date && ISO.test(it.expiry_date) ? it.expiry_date : null,
      area_sq_km: typeof it.area_sq_km === "number" && isFinite(it.area_sq_km) ? it.area_sq_km : null,
      status: it.status,
      responsible: it.responsible,
      notes: it.notes,
      updated_at: new Date().toISOString(),
    };
    if (it.contour) {
      row.contour = it.contour;
      row.contour_source = "Загрузка из Excel";
      if (row.area_sq_km == null) {
        const a = contourAreaKm2(it.contour);
        if (a) row.area_sq_km = Math.round(a * 100) / 100;
      }
    }
    const found = byNumber.get(number);
    if (found) {
      if (!updateExisting) {
        res.skipped++;
        continue;
      }
      const { error } = await supabase.from("licenses").update(row).eq("id", found.id);
      if (error) res.errors.push(`${number}: ${error.message}`);
      else res.updated++;
    } else {
      const { data, error } = await supabase.from("licenses").insert(row).select("id, license_number, area_sq_km").single();
      if (error) res.errors.push(`${number}: ${error.message}`);
      else {
        res.created++;
        byNumber.set(number, data);
      }
    }
  }
  res.ok = res.errors.length === 0;
  revalidatePath("/", "layout");
  return res;
}

export type DrillSaveItem = {
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

/** Saves drill holes for a licence. A hole with the same number is replaced together with its intervals. */
export async function saveDrillholes(licenseId: number, holes: DrillSaveItem[], removeTest: boolean) {
  const supabase = await createClient();
  if (!Array.isArray(holes) || holes.length === 0) return { ok: false, message: "Нет скважин для загрузки.", saved: 0 };
  if (holes.length > 3000) return { ok: false, message: "За один раз можно загрузить до 3000 скважин.", saved: 0 };
  if (removeTest) await supabase.from("drillholes").delete().eq("license_id", licenseId).eq("is_test", true);
  let saved = 0;
  const errors: string[] = [];
  for (const h of holes) {
    await supabase.from("drillholes").delete().eq("license_id", licenseId).eq("hole_id", h.hole_id);
    const { data, error } = await supabase
      .from("drillholes")
      .insert({
        license_id: licenseId,
        hole_id: String(h.hole_id).slice(0, 80),
        lon: Number(h.lon),
        lat: Number(h.lat),
        elevation_m: h.elevation_m,
        azimuth_deg: h.azimuth_deg,
        dip_deg: h.dip_deg,
        depth_m: h.depth_m,
        year: h.year,
        notes: h.notes,
      })
      .select("id")
      .single();
    if (error) {
      errors.push(`${h.hole_id}: ${error.message}`);
      continue;
    }
    if (h.intervals?.length) {
      for (let i = 0; i < h.intervals.length; i += 500) {
        const { error: e2 } = await supabase
          .from("drill_intervals")
          .insert(h.intervals.slice(i, i + 500).map((x) => ({ ...x, drillhole_id: data.id })));
        if (e2) errors.push(`${h.hole_id}: интервалы — ${e2.message}`);
      }
    }
    saved++;
  }
  revalidatePath(`/licenses/${licenseId}`);
  return { ok: errors.length === 0, message: errors.slice(0, 5).join("; "), saved };
}
