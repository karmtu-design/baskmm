import { createBrowserClient } from "@supabase/ssr";

/** Supabase from the browser, signed in as the current user (used for uploading files straight to storage). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
