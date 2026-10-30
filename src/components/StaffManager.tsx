"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Row, Text } from "@once-ui-system/core";
import { tr } from "@/i18n";
import { addStaff, changeMyPassword, deleteStaff, setFoundingAccess, setStaffPassword, updateStaff } from "@/app/(app)/staff/actions";
import type { StaffMember } from "@/lib/types";

const ROLE_LABEL: Record<StaffMember["role"], string> = { admin: "Администратор", editor: "Редактор", viewer: "Просмотр" };
const ROLE_HINT: Record<StaffMember["role"], string> = {
  admin: "меняет данные и управляет сотрудниками",
  editor: "добавляет, меняет и удаляет данные",
  viewer: "только смотрит",
};

/** A readable random password: 3 groups of letters and digits, e.g. «kt7m-q4zr-9wpa». */
function suggestPassword() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  const s = Array.from(r, (v) => a[v % a.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export default function StaffManager({ staff, me, isAdmin, serviceKey }: { staff: StaffMember[]; me: string | null; isAdmin: boolean; serviceKey: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Column gap="32">
      {isAdmin && !serviceKey && <KeyHelp />}
      {isAdmin && <AddForm disabled={!serviceKey} onDone={setMsg} />}
      {msg && (
        <Text variant="body-default-s" onBackground={msg.ok ? "success-strong" : "danger-strong"} role="status">
          {msg.text}
        </Text>
      )}
      <div className="data-table-wrap">
        <table className="data-table staff-table">
          <thead>
            <tr>
              <th>{tr("Сотрудник")}</th>
              <th>{tr("Должность")}</th>
              <th>{tr("Телефон")}</th>
              <th>{tr("Роль")}</th>
              <th title={tr("Доступ к учредительным документам компаний. Выдаёт и снимает администратор.")}>{tr("Учредительные документы")}</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <StaffRow key={s.user_id} s={s} isMe={s.user_id === me} isAdmin={isAdmin} serviceKey={serviceKey} onDone={setMsg} />
            ))}
          </tbody>
        </table>
      </div>
      <MyPassword />
    </Column>
  );
}

function StaffRow({ s, isMe, isAdmin, serviceKey, onDone }: { s: StaffMember; isMe: boolean; isAdmin: boolean; serviceKey: boolean; onDone: (m: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ full_name: s.full_name ?? "", position: s.position ?? "", phone: s.phone ?? "", role: s.role });
  const [pending, start] = useTransition();
  const canEdit = isAdmin || isMe;

  function save() {
    start(async () => {
      const r = await updateStaff(s.user_id, f);
      onDone(r.ok ? { ok: true, text: tr("Сохранено: {0}", { 0: f.full_name || s.email }) } : { ok: false, text: r.message ?? "" });
      if (r.ok) {
        setEdit(false);
        router.refresh();
      }
    });
  }
  function newPassword() {
    const p = prompt(tr("Новый пароль для {0} (не меньше 8 знаков). Передайте его сотруднику лично.", { 0: s.email }), suggestPassword());
    if (!p) return;
    start(async () => {
      const r = await setStaffPassword(s.user_id, p);
      onDone(r.ok ? { ok: true, text: tr("Пароль для {0} изменён. Передайте его сотруднику: {1}", { 0: s.email, 1: p }) } : { ok: false, text: r.message ?? "" });
    });
  }
  function remove() {
    if (!confirm(tr("Удалить вход сотрудника {0}? Он больше не сможет войти. Всё, что он вносил, останется.", { 0: s.full_name || s.email }))) return;
    start(async () => {
      const r = await deleteStaff(s.user_id);
      onDone(r.ok ? { ok: true, text: tr("Вход {0} удалён.", { 0: s.email }) } : { ok: false, text: r.message ?? "" });
      if (r.ok) router.refresh();
    });
  }

  if (edit)
    return (
      <tr className="is-editing">
        <td>
          <input className="field" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder={tr("ФИО")} aria-label={tr("ФИО")} />
          <div className="staff-mail">{s.email}</div>
        </td>
        <td>
          <input className="field" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} placeholder={tr("например, главный геолог")} aria-label={tr("Должность")} />
        </td>
        <td>
          <input className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+7 7__ ___ __ __" aria-label={tr("Телефон")} />
        </td>
        <td>
          {isAdmin ? (
            <select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as StaffMember["role"] })} aria-label={tr("Роль")}>
              {(["admin", "editor", "viewer"] as const).map((r) => (
                <option key={r} value={r}>
                  {tr(ROLE_LABEL[r])} — {tr(ROLE_HINT[r])}
                </option>
              ))}
            </select>
          ) : (
            <RoleBadge role={s.role} />
          )}
        </td>
        <td>
          <FoundingCell s={s} isAdmin={isAdmin} onDone={onDone} />
        </td>
        <td>
          <Row gap="8">
            <Button size="s" onClick={save} loading={pending}>{tr("Сохранить")}</Button>
            <Button size="s" variant="tertiary" onClick={() => setEdit(false)}>{tr("Отмена")}</Button>
          </Row>
        </td>
      </tr>
    );

  return (
    <tr>
      <td>
        <b>{s.full_name || "—"}</b>
        {isMe && <span className="staff-me">{tr("это вы")}</span>}
        <div className="staff-mail">{s.email}</div>
      </td>
      <td>{s.position || "—"}</td>
      <td>{s.phone ? <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a> : "—"}</td>
      <td>
        <RoleBadge role={s.role} />
      </td>
      <td>
        <FoundingCell s={s} isAdmin={isAdmin} onDone={onDone} />
      </td>
      {(isAdmin || canEdit) && (
        <td>
          <Row gap="4" wrap>
            {canEdit && <Button size="s" variant="secondary" onClick={() => setEdit(true)}>{tr("Изменить")}</Button>}
            {isAdmin && serviceKey && <Button size="s" variant="tertiary" onClick={newPassword} disabled={pending}>{tr("Новый пароль")}</Button>}
            {isAdmin && serviceKey && !isMe && <Button size="s" variant="tertiary" onClick={remove} disabled={pending}>{tr("Удалить")}</Button>}
          </Row>
        </td>
      )}
    </tr>
  );
}

/** Access to founding documents: a switch for the administrator, a plain «есть / нет» for everyone else. */
function FoundingCell({ s, isAdmin, onDone }: { s: StaffMember; isAdmin: boolean; onDone: (m: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (s.role === "admin") return <span className="access-note">{tr("есть всегда")}</span>;
  if (!isAdmin) return <span className={`access-note${s.founding_access ? " is-on" : ""}`}>{s.founding_access ? tr("есть") : tr("нет")}</span>;
  function toggle(on: boolean) {
    start(async () => {
      const r = await setFoundingAccess(s.user_id, on);
      onDone(
        r.ok
          ? { ok: true, text: on ? tr("{0} теперь видит учредительные документы.", { 0: s.full_name || s.email }) : tr("{0} больше не видит учредительные документы.", { 0: s.full_name || s.email }) }
          : { ok: false, text: r.message ?? "" }
      );
      if (r.ok) router.refresh();
    });
  }
  return (
    <label className={`access-switch${pending ? " is-busy" : ""}`}>
      <input type="checkbox" role="switch" checked={s.founding_access} disabled={pending} onChange={(e) => toggle(e.target.checked)} />
      <span aria-hidden />
      {s.founding_access ? tr("есть доступ") : tr("нет доступа")}
    </label>
  );
}

function RoleBadge({ role }: { role: StaffMember["role"] }) {
  return (
    <span className={`role-badge role-${role}`} title={tr(ROLE_HINT[role])}>
      {tr(ROLE_LABEL[role])}
    </span>
  );
}

function AddForm({ disabled, onDone }: { disabled: boolean; onDone: (m: { ok: boolean; text: string }) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "", position: "", phone: "", role: "editor" });
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Row>
        <Button prefixIcon="plus" onClick={() => (setOpen(true), setF((x) => ({ ...x, password: suggestPassword() })))} disabled={disabled}>{tr("Добавить сотрудника")}</Button>
      </Row>
    );
  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await addStaff(f);
      onDone(
        r.ok
          ? { ok: true, text: tr("Готово. Передайте сотруднику: адрес сайта, почта {0} и пароль {1}. Пароль он потом сможет сменить сам на этой странице.", { 0: f.email, 1: f.password }) }
          : { ok: false, text: r.message ?? "" }
      );
      if (r.ok) {
        setOpen(false);
        setF({ email: "", password: "", full_name: "", position: "", phone: "", role: "editor" });
        router.refresh();
      }
    });
  }
  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field-label">
      {label}
      <input className="field" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  );
  return (
    <form onSubmit={submit} className="staff-add">
      <h2>{tr("Новый сотрудник")}</h2>
      <div className="staff-add-grid">
        {field("full_name", tr("ФИО"), { placeholder: tr("например, Серикбаева Асель") })}
        {field("email", tr("Почта для входа"), { type: "email", required: true })}
        {field("position", tr("Должность"), { placeholder: tr("например, главный геолог") })}
        {field("phone", tr("Телефон"), { placeholder: "+7 7__ ___ __ __" })}
        <label className="field-label">
          {tr("Роль")}
          <select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {(["editor", "viewer", "admin"] as const).map((r) => (
              <option key={r} value={r}>
                {tr(ROLE_LABEL[r])} — {tr(ROLE_HINT[r])}
              </option>
            ))}
          </select>
        </label>
        {field("password", tr("Пароль (передайте сотруднику)"), { required: true, minLength: 8 })}
      </div>
      <Row gap="8">
        <Button type="submit" loading={pending}>{tr("Добавить")}</Button>
        <Button type="button" variant="tertiary" onClick={() => setOpen(false)}>{tr("Отмена")}</Button>
      </Row>
    </form>
  );
}

function MyPassword() {
  const [p, setP] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="staff-add"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await changeMyPassword(p);
          setMsg(r.ok ? { ok: true, text: tr("Пароль изменён. В следующий раз входите с новым паролем.") } : { ok: false, text: r.message ?? "" });
          if (r.ok) setP("");
        });
      }}
    >
      <h2>{tr("Сменить мой пароль")}</h2>
      <Row gap="8" vertical="end" wrap>
        <label className="field-label" style={{ minWidth: 260 }}>
          {tr("Новый пароль, не меньше 8 знаков")}
          <input className="field" type="password" autoComplete="new-password" value={p} onChange={(e) => setP(e.target.value)} minLength={8} required />
        </label>
        <Button type="submit" variant="secondary" loading={pending}>{tr("Сменить пароль")}</Button>
      </Row>
      {msg && (
        <Text variant="body-default-s" onBackground={msg.ok ? "success-strong" : "danger-strong"} role="status">
          {msg.text}
        </Text>
      )}
    </form>
  );
}

function KeyHelp() {
  return (
    <div className="staff-key">
      <b>{tr("Чтобы добавлять и удалять сотрудников здесь, один раз положите служебный ключ Supabase в настройки Vercel:")}</b>
      <ol>
        <li>{tr("Supabase → проект bask-mining-db → Project Settings → API Keys. Скопируйте ключ «service_role» (или «secret»). Никому его не пересылайте.")}</li>
        <li>{tr("Vercel → проект baskmm → Settings → Environment Variables → Add. Имя: SUPABASE_SERVICE_ROLE_KEY, значение: скопированный ключ, окружения: Production и Preview. Save.")}</li>
        <li>{tr("Vercel → Deployments → у последнего развёртывания «⋯» → Redeploy. Через 2–3 минуты кнопки станут активны.")}</li>
      </ol>
      <span>{tr("Пока ключа нет, роли, ФИО и должности можно менять, а новых сотрудников — добавлять в Supabase: Authentication → Users → Add user. Они сами появятся в этом списке с ролью «Просмотр».")}</span>
    </div>
  );
}
