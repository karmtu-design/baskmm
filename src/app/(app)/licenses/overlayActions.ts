"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Corners = [[number, number], [number, number], [number, number], [number, number]];

const okCorners = (c: unknown): c is Corners =>
  Array.isArray(c) && c.length === 4 && c.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && isFinite(v)));

/** Saves a map picture the browser has already put into storage. */
export async function addOverlay(licenseId: number, title: string, filePath: string, corners: Corners, crs: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Войдите в систему заново." };
  if (!okCorners(corners)) return { ok: false, message: "Неверные координаты углов." };
  const { error } = await supabase.from("map_overlays").insert({
    license_id: licenseId,
    title: (title || "Карта").slice(0, 200),
    file_path: filePath,
    corners,
    crs: crs.slice(0, 120),
    uploaded_by: user.email ?? null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/licenses/${licenseId}`);
  return { ok: true };
}

export async function setOverlayOpacity(id: number, opacity: number) {
  const supabase = await createClient();
  await supabase.from("map_overlays").update({ opacity: Math.min(1, Math.max(0, opacity)) }).eq("id", id);
}

export async function deleteOverlay(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("map_overlays").select("file_path, license_id").eq("id", id).maybeSingle();
  if (!data) return { ok: false, message: "Карта уже удалена." };
  await supabase.storage.from("documents").remove([data.file_path]);
  const { error } = await supabase.from("map_overlays").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/licenses/${data.license_id}`);
  return { ok: true };
}
