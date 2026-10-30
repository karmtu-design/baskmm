"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { editDenied } from "@/lib/roles";
import type { Task, TaskStatus } from "@/lib/types";

export type TaskFields = Pick<Task, "title" | "description" | "priority" | "assignee" | "due_date" | "license_id" | "project_id"> & { status?: TaskStatus };

const STATUSES: TaskStatus[] = ["new", "in_progress", "review", "done"];
const text = (v: unknown, max = 4000) => {
  const s = v == null ? "" : String(v).trim().slice(0, max);
  return s === "" ? null : s;
};
function clean(f: TaskFields) {
  return {
    title: text(f.title, 300) ?? "",
    description: text(f.description),
    priority: ["low", "normal", "high"].includes(f.priority) ? f.priority : "normal",
    assignee: text(f.assignee, 120),
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(f.due_date ?? "") ? f.due_date : null,
    license_id: f.license_id ? Number(f.license_id) : null,
    project_id: f.project_id ? Number(f.project_id) : null,
  };
}
function refresh(t: { license_id?: number | null; project_id?: number | null }) {
  revalidatePath("/tasks");
  if (t.license_id) revalidatePath(`/licenses/${t.license_id}`);
  if (t.project_id) revalidatePath(`/projects/${t.project_id}`);
}

export async function createTask(f: TaskFields): Promise<{ ok: boolean; message?: string }> {
  { const denied = await editDenied(); if (denied) return { ok: false, message: denied }; }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const row = clean(f);
  if (!row.title) return { ok: false, message: "Напишите, что нужно сделать." };
  const status = f.status && STATUSES.includes(f.status) ? f.status : "new";
  const { data: last } = await supabase.from("tasks").select("position").eq("status", status).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("tasks").insert({ ...row, status, position: (last?.[0]?.position ?? 0) + 1, created_by: user?.email ?? null });
  if (error) return { ok: false, message: error.message };
  refresh(row);
  return { ok: true };
}

export async function updateTask(id: number, f: TaskFields): Promise<{ ok: boolean; message?: string }> {
  { const denied = await editDenied(); if (denied) return { ok: false, message: denied }; }
  const supabase = await createClient();
  const row = clean(f);
  if (!row.title) return { ok: false, message: "Напишите, что нужно сделать." };
  const extra = f.status && STATUSES.includes(f.status) ? { status: f.status, completed_at: f.status === "done" ? new Date().toISOString() : null } : {};
  const { error } = await supabase
    .from("tasks")
    .update({ ...row, ...extra, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh(row);
  return { ok: true };
}

/** Drag and drop on the board: new column and place within it. */
export async function moveTask(id: number, status: TaskStatus, position: number) {
  { const denied = await editDenied(); if (denied) return { ok: false, message: denied }; }
  if (!STATUSES.includes(status) || !isFinite(position)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status, position, completed_at: status === "done" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("license_id, project_id")
    .single();
  if (error) return { ok: false, message: error.message };
  refresh(data);
  return { ok: true };
}

export async function deleteTask(id: number) {
  { const denied = await editDenied(); if (denied) return { ok: false, message: denied }; }
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("license_id, project_id, auto_key").eq("id", id).maybeSingle();
  // a renewal task made by the system is closed rather than deleted, so it is not created again
  const { error } = data?.auto_key
    ? await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh(data ?? {});
  return { ok: true };
}
