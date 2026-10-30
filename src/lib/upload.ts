"use client";

// Uploading files to Supabase Storage in 6 MB pieces (the tus protocol, as in Uppy): if the internet drops,
// the upload continues from the last piece instead of starting over, and the progress can be shown.
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

/** The largest file the storage accepts. 50 MB on Supabase's free plan; raise NEXT_PUBLIC_MAX_UPLOAD_MB after upgrading. */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const CHUNK = 6 * 1024 * 1024; // Supabase requires exactly 6 MB pieces

export async function uploadFile(bucket: string, path: string, file: File, onProgress?: (share: number) => void): Promise<{ error: string | null }> {
  const supabase = createClient();
  // small files: one ordinary request is faster
  if (file.size <= CHUNK) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
    onProgress?.(1);
    return { error: error?.message ?? null };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "нет входа в систему" };
  return new Promise((resolve) => {
    const up = new tus.Upload(file, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: CHUNK,
      metadata: { bucketName: bucket, objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onError: (e) => resolve({ error: e.message.replace(/\s*response text:.*$/is, "") }),
      onSuccess: () => resolve({ error: null }),
    });
    // a file interrupted earlier on this computer continues where it stopped
    up.findPreviousUploads().then((prev) => {
      if (prev.length) up.resumeFromPreviousUpload(prev[0]);
      up.start();
    });
  });
}
