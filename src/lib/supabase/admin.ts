import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase with the service key, for the few things only an administrator may do: creating, deleting
 * and re-passwording logins. The key lives only on the server (Vercel setting SUPABASE_SERVICE_ROLE_KEY)
 * and is never sent to the browser. Returns null while the key is not set.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
