// Who may change what. The database itself enforces it (row-level security with the staff roles);
// these helpers only give a clear message instead of a silent «nothing happened» for read-only staff.
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "editor" | "viewer";
export const READ_ONLY_MESSAGE = "У вас права только на просмотр. Чтобы вносить изменения, попросите администратора сменить вам роль на странице «Сотрудники».";

export async function myRole(): Promise<Role> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_role");
  return data === "admin" || data === "editor" ? data : "viewer";
}

/** null when the current person may change data, otherwise the message to show. */
export async function editDenied(): Promise<string | null> {
  return (await myRole()) === "viewer" ? READ_ONLY_MESSAGE : null;
}
