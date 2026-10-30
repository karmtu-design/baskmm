"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { myRole, type Role } from "@/lib/roles";

type Result = { ok: boolean; message?: string };
const ROLES: Role[] = ["admin", "editor", "viewer"];
const NO_KEY =
  "Чтобы добавлять и удалять сотрудников прямо на сайте, в настройках Vercel нужен служебный ключ Supabase (SUPABASE_SERVICE_ROLE_KEY). Инструкция — на этой странице.";
const clean = (v: unknown, max = 200) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s === "" ? null : s;
};

async function adminOnly(): Promise<string | null> {
  return (await myRole()) === "admin" ? null : "Это может делать только администратор.";
}

/** Name, position, phone, role. An administrator edits anyone; others only their own name, position and phone. */
export async function updateStaff(userId: string, f: { full_name?: string; position?: string; phone?: string; role?: string }): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Войдите в систему заново." };
  const admin = (await myRole()) === "admin";
  if (!admin && user.id !== userId) return { ok: false, message: "Можно менять только свои данные." };
  const patch: Record<string, unknown> = { full_name: clean(f.full_name), position: clean(f.position), phone: clean(f.phone, 60) };
  if (admin && f.role && ROLES.includes(f.role as Role)) patch.role = f.role;
  const { data, error } = await supabase.from("staff").update(patch).eq("user_id", userId).select("user_id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Не сохранилось: нет прав." };
  revalidatePath("/staff");
  return { ok: true };
}

/** A new login with a password the administrator gives to the person. */
export async function addStaff(f: { email: string; password: string; full_name?: string; position?: string; phone?: string; role: string }): Promise<Result> {
  const denied = await adminOnly();
  if (denied) return { ok: false, message: denied };
  const sb = createAdminClient();
  if (!sb) return { ok: false, message: NO_KEY };
  const email = String(f.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Проверьте адрес почты." };
  if (String(f.password ?? "").length < 8) return { ok: false, message: "Пароль — не меньше 8 знаков." };
  const role = ROLES.includes(f.role as Role) ? f.role : "viewer";
  const { data, error } = await sb.auth.admin.createUser({ email, password: f.password, email_confirm: true });
  if (error || !data.user)
    return { ok: false, message: /already|exists|registered/i.test(error?.message ?? "") ? "Сотрудник с такой почтой уже есть." : (error?.message ?? "Не получилось.") };
  // the staff row is made by the database when the login appears; fill in the rest
  await sb
    .from("staff")
    .upsert({ user_id: data.user.id, email, full_name: clean(f.full_name), position: clean(f.position), phone: clean(f.phone, 60), role }, { onConflict: "user_id" });
  revalidatePath("/staff");
  return { ok: true };
}

export async function setStaffPassword(userId: string, password: string): Promise<Result> {
  const denied = await adminOnly();
  if (denied) return { ok: false, message: denied };
  const sb = createAdminClient();
  if (!sb) return { ok: false, message: NO_KEY };
  if (String(password ?? "").length < 8) return { ok: false, message: "Пароль — не меньше 8 знаков." };
  const { error } = await sb.auth.admin.updateUserById(userId, { password });
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function deleteStaff(userId: string): Promise<Result> {
  const denied = await adminOnly();
  if (denied) return { ok: false, message: denied };
  const sb = createAdminClient();
  if (!sb) return { ok: false, message: NO_KEY };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === userId) return { ok: false, message: "Себя удалить нельзя: попросите другого администратора." };
  const { data: row } = await sb.from("staff").select("role").eq("user_id", userId).maybeSingle();
  if (row?.role === "admin") {
    const { count } = await sb.from("staff").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return { ok: false, message: "В системе должен остаться хотя бы один администратор." };
  }
  // the login is deleted; what the person entered stays, with their e-mail in the change log
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/staff");
  return { ok: true };
}

/** Anyone can change their own password. */
export async function changeMyPassword(password: string): Promise<Result> {
  if (String(password ?? "").length < 8) return { ok: false, message: "Пароль — не меньше 8 знаков." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, message: /same|different/i.test(error.message) ? "Новый пароль совпадает со старым." : error.message } : { ok: true };
}

/** Access to the founding documents of companies: only an administrator gives or takes it away. */
export async function setFoundingAccess(userId: string, on: boolean): Promise<Result> {
  const denied = await adminOnly();
  if (denied) return { ok: false, message: denied };
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff").update({ founding_access: !!on }).eq("user_id", userId).select("user_id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Не сохранилось: нет прав." };
  revalidatePath("/staff");
  revalidatePath("/companies", "layout");
  return { ok: true };
}
