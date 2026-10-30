"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DocMeta = {
  kind: "document" | "history";
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
  size_bytes: number;
};

const clean = (v: unknown, max = 500) => {
  const s = v == null ? "" : String(v).trim().slice(0, max);
  return s === "" ? null : s;
};

function where(m: { license_id: number | null; project_id: number | null }) {
  if (m.license_id) revalidatePath(`/licenses/${m.license_id}`);
  if (m.project_id) revalidatePath(`/projects/${m.project_id}`);
  revalidatePath("/documents");
}

/** Saves the card of a file the browser has already put into storage; returns its id. */
export async function addDocument(m: DocMeta): Promise<{ ok: boolean; id?: number; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Войдите в систему заново." };
  const year = m.year && m.year > 1800 && m.year < 2200 ? Math.round(m.year) : null;
  const { data, error } = await supabase
    .from("documents")
    .insert({
      kind: m.kind === "history" ? "history" : "document",
      license_id: m.license_id,
      project_id: m.project_id,
      title: clean(m.title) ?? m.file_name,
      category: clean(m.category, 100),
      doc_date: /^\d{4}-\d{2}-\d{2}$/.test(m.doc_date ?? "") ? m.doc_date : null,
      year,
      source: clean(m.source),
      notes: clean(m.notes, 4000),
      file_path: m.file_path,
      file_name: m.file_name.slice(0, 300),
      mime_type: clean(m.mime_type, 200),
      size_bytes: m.size_bytes,
      uploaded_by: user.email ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  where(m);
  return { ok: true, id: data.id };
}

export async function updateDocument(
  id: number,
  f: { title: string; category: string | null; doc_date: string | null; year: number | null; source: string | null; notes: string | null }
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const title = clean(f.title);
  if (!title) return { ok: false, message: "Укажите название." };
  const { data, error } = await supabase
    .from("documents")
    .update({
      title,
      category: clean(f.category, 100),
      doc_date: /^\d{4}-\d{2}-\d{2}$/.test(f.doc_date ?? "") ? f.doc_date : null,
      year: f.year && f.year > 1800 && f.year < 2200 ? Math.round(f.year) : null,
      source: clean(f.source),
      notes: clean(f.notes, 4000),
    })
    .eq("id", id)
    .select("license_id, project_id")
    .single();
  if (error) return { ok: false, message: error.message };
  where(data);
  return { ok: true };
}

export async function deleteDocument(id: number): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("file_path, license_id, project_id").eq("id", id).maybeSingle();
  if (!data) return { ok: false, message: "Документ уже удалён." };
  const { error: e1 } = await supabase.storage.from("documents").remove([data.file_path]);
  if (e1) return { ok: false, message: e1.message };
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  where(data);
  return { ok: true };
}

export type DocHit = { id: number; snippet: string };

/** Full-text search over titles, notes and the text read from the files (Russian word forms included). */
export async function searchDocuments(q: string, filter: { licenseId?: number; projectId?: number } = {}): Promise<{ hits: DocHit[]; message?: string }> {
  const query = q.trim().slice(0, 200);
  if (!query) return { hits: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_documents", {
    q: query,
    lic: filter.licenseId ?? null,
    proj: filter.projectId ?? null,
    max_rows: 100,
  });
  if (error) return { hits: [], message: error.message };
  return { hits: (data ?? []).map((r: { id: number; snippet: string }) => ({ id: Number(r.id), snippet: r.snippet ?? "" })) };
}
