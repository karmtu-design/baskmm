"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PotentialProject } from "@/lib/types";

/** Fields a person can edit; the same set comes from the form and from Excel. */
export type ProjectFields = Omit<PotentialProject, "id" | "created_at" | "updated_at">;

const TEXT_KEYS = [
  "name",
  "commodity",
  "region",
  "district",
  "stage",
  "deal_type",
  "holder",
  "source",
  "contact",
  "resources",
  "terms",
  "responsible",
  "next_step",
  "link",
  "notes",
] as const;

function tidy(input: Partial<Record<keyof ProjectFields, unknown>>): Partial<ProjectFields> {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) {
    if (!(k in input)) continue;
    const s = input[k] == null ? "" : String(input[k]).trim();
    out[k] = s === "" ? null : s.slice(0, 4000);
  }
  if ("next_date" in input) {
    const d = input.next_date == null ? "" : String(input.next_date);
    out.next_date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }
  for (const k of ["lat", "lon"] as const) {
    if (!(k in input)) continue;
    const n = input[k] == null || input[k] === "" ? NaN : Number(String(input[k]).replace(",", "."));
    out[k] = Number.isFinite(n) ? n : null;
  }
  return out as Partial<ProjectFields>;
}

function fromForm(f: FormData) {
  const raw: Record<string, unknown> = {};
  for (const k of [...TEXT_KEYS, "next_date", "lat", "lon"]) raw[k] = f.get(k);
  return tidy(raw as Partial<Record<keyof ProjectFields, unknown>>);
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const fields = fromForm(formData);
  if (!fields.name) throw new Error("Укажите название проекта");
  const { data, error } = await supabase.from("potential_projects").insert(fields).select("id").single();
  if (error) throw new Error(error.message.includes("duplicate") ? "Проект с таким названием уже есть" : error.message);
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(id: number, formData: FormData) {
  const supabase = await createClient();
  const fields = fromForm(formData);
  if (!fields.name) throw new Error("Укажите название проекта");
  const { error } = await supabase
    .from("potential_projects")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message.includes("duplicate") ? "Проект с таким названием уже есть" : error.message);
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function deleteProject(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("potential_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  redirect("/projects");
}

export type ProjectImportResult = { ok: boolean; created: number; updated: number; skipped: number; errors: string[] };

/** Rows from Excel: a project whose name is already in the system is updated, the rest are added. */
export async function importProjects(
  rows: Partial<Record<keyof ProjectFields, unknown>>[],
  updateExisting: boolean
): Promise<ProjectImportResult> {
  const supabase = await createClient();
  const res: ProjectImportResult = { ok: true, created: 0, updated: 0, skipped: 0, errors: [] };
  if (!Array.isArray(rows) || rows.length === 0) return { ...res, ok: false, errors: ["Нет строк для загрузки."] };
  if (rows.length > 2000) return { ...res, ok: false, errors: ["За один раз можно загрузить до 2000 проектов."] };

  const { data: existing } = await supabase.from("potential_projects").select("id, name");
  const byName = new Map((existing ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as number]));

  for (const r of rows) {
    const fields = tidy(r);
    if (!fields.name) {
      res.skipped++;
      continue;
    }
    const id = byName.get(fields.name.toLowerCase());
    if (id) {
      if (!updateExisting) {
        res.skipped++;
        continue;
      }
      const { error } = await supabase
        .from("potential_projects")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) res.errors.push(`${fields.name}: ${error.message}`);
      else res.updated++;
    } else {
      const { data, error } = await supabase.from("potential_projects").insert(fields).select("id").single();
      if (error) res.errors.push(`${fields.name}: ${error.message}`);
      else {
        res.created++;
        byName.set(fields.name.toLowerCase(), data.id);
      }
    }
  }
  res.ok = res.errors.length === 0;
  revalidatePath("/projects");
  return res;
}
