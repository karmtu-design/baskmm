"use client";

// Saving a stored file under its real name. A link straight to the storage makes the browser take
// the name from the storage's reply, and Chrome then shows Russian names as %D0%9F%D1%80… .
// Here the file is fetched first and handed to the browser with the name we choose.
import { createClient } from "@/lib/supabase/client";

export async function saveStoredFile(bucket: string, path: string, fileName: string) {
  const { data, error } = await createClient().storage.from(bucket).download(path);
  if (error || !data) throw new Error(error?.message || "file not found");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "file";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
