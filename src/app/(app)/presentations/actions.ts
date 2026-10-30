"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { editDenied } from "@/lib/roles";

export type PresentationMeta = {
  title: string;
  project: string | null;
  language: string | null;
  description: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
};

const clean = (v: string | null | undefined, max = 300) => {
  const s = (v ?? "").trim().slice(0, max);
  return s === "" ? null : s;
};

/** Saves the card of a file that the browser has already put into storage. */
export async function addPresentation(meta: PresentationMeta): Promise<{ ok: boolean; message?: string }> {
  { const denied = await editDenied(); if (denied) return { ok: false, message: denied }; }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Войдите в систему заново." };
  const title = clean(meta.title) ?? meta.file_name;
  const { error } = await supabase.from("presentations").insert({
    title,
    project: clean(meta.project),
    language: clean(meta.language, 40),
    description: clean(meta.description, 2000),
    file_path: meta.file_path,
    file_name: meta.file_name.slice(0, 300),
    mime_type: clean(meta.mime_type, 200),
    size_bytes: meta.size_bytes,
    uploaded_by: user.email ?? null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/presentations");
  return { ok: true };
}

export async function updatePresentation(
  id: number,
  fields: { title: string; project: string | null; language: string | null; description: string | null }
): Promise<{ ok: boolean; message?: string }> {
  { const denied = await editDenied(); if (denied) return { ok: false, message: denied }; }
  const supabase = await createClient();
  const title = clean(fields.title);
  if (!title) return { ok: false, message: "Укажите название." };
  const { error } = await supabase
    .from("presentations")
    .update({ title, project: clean(fields.project), language: clean(fields.language, 40), description: clean(fields.description, 2000) })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/presentations");
  return { ok: true };
}

/** Removes the file from storage and its card. */
export async function deletePresentation(id: number): Promise<{ ok: boolean; message?: string }> {
  { const denied = await editDenied(); if (denied) return { ok: false, message: denied }; }
  const supabase = await createClient();
  const { data } = await supabase.from("presentations").select("file_path").eq("id", id).maybeSingle();
  if (!data) return { ok: false, message: "Презентация уже удалена." };
  const { error: e1 } = await supabase.storage.from("presentations").remove([data.file_path]);
  if (e1) return { ok: false, message: e1.message };
  const { error } = await supabase.from("presentations").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/presentations");
  return { ok: true };
}
