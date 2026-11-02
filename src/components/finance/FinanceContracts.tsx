"use client";

// Реестр договоров: every contract of the group with its amount, payments made and planned, what is left.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Row, Text } from "@once-ui-system/core";
import { tr } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/upload";
import { CURRENCIES, byCurrency, daysTo, fmtDate, money, sum, toKzt } from "@/lib/money";
import type { FinContract, FinPayment, KztRates } from "@/lib/finance";
import { Modal, Tiles, clean, companyName, errText, me } from "./ui";

type Co = { id: number; name: string };
const STATUS: Record<FinContract["status"], string> = { draft: "проект", active: "действует", closed: "исполнен", terminated: "расторгнут" };

export default function FinanceContracts({ contracts, payments, companies, rates, edit }: { contracts: FinContract[]; payments: FinPayment[]; companies: Co[]; rates: KztRates; edit: boolean }) {
  const [q, setQ] = useState("");
  const [co, setCo] = useState("");
  const [dir, setDir] = useState("");
  const [st, setSt] = useState("active");
  const [open, setOpen] = useState<FinContract | "new" | null>(null);

  const paidOf = (c: FinContract) => sum(payments.filter((p) => p.contract_id === c.id && !p.planned).map((p) => p.amount));
  const list = useMemo(
    () =>
      contracts.filter(
        (c) =>
          (!co || String(c.company_id) === co) &&
          (!dir || c.direction === dir) &&
          (!st || c.status === st) &&
          (!q || `${c.counterparty} ${c.counterparty_bin ?? ""} ${c.number ?? ""} ${c.subject ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [contracts, co, dir, st, q]
  );
  const active = contracts.filter((c) => c.status === "active");
  const left = (d: FinContract["direction"]) =>
    sum(active.filter((c) => c.direction === d).map((c) => toKzt(Math.max(0, (c.amount ?? 0) - paidOf(c)), c.currency, rates) ?? 0));
  const soon = payments.filter((p) => p.planned && (daysTo(p.pay_date) ?? 99) <= 7);
  const ending = active.filter((c) => { const d = daysTo(c.ends_on); return d != null && d <= 30; });

  return (
    <div className="fin-stack">
      <Tiles
        items={[
          { label: tr("Действующих договоров"), value: active.length },
          { label: tr("Осталось заплатить по договорам"), value: money(left("expense")), hint: tr("в тенге по курсу НБ РК") },
          { label: tr("Осталось получить по договорам"), value: money(left("income")), hint: tr("в тенге по курсу НБ РК") },
          { label: tr("Плановые платежи на 7 дней"), value: soon.length, tone: soon.length ? "warn" : undefined, hint: soon.length ? money(sum(soon.map((p) => toKzt(p.amount, p.currency, rates)))) : undefined },
          { label: tr("Заканчиваются в течение 30 дней"), value: ending.length, tone: ending.length ? "warn" : undefined },
        ]}
      />
      <div className="fin-filters">
        <input className="field" type="search" placeholder={tr("Поиск: контрагент, БИН, номер, предмет")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field" value={co} onChange={(e) => setCo(e.target.value)} aria-label={tr("Компания")}>
          <option value="">{tr("Все компании")}</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{companyName(companies, c.id)}</option>)}
        </select>
        <select className="field" value={dir} onChange={(e) => setDir(e.target.value)} aria-label={tr("Вид")}>
          <option value="">{tr("Расходные и доходные")}</option>
          <option value="expense">{tr("Расходные (платим мы)")}</option>
          <option value="income">{tr("Доходные (платят нам)")}</option>
        </select>
        <select className="field" value={st} onChange={(e) => setSt(e.target.value)} aria-label={tr("Статус")}>
          <option value="">{tr("Все статусы")}</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
        </select>
        {edit && <Button prefixIcon="plus" onClick={() => setOpen("new")}>{tr("Договор")}</Button>}
      </div>

      {list.length === 0 ? (
        <Text onBackground="neutral-weak">{contracts.length ? tr("Ничего не найдено. Измените фильтр.") : tr("Договоров пока нет.")}</Text>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table fin-table">
            <thead>
              <tr>
                <th>{tr("Контрагент")}</th>
                <th>{tr("Компания группы")}</th>
                <th>{tr("№ и дата")}</th>
                <th>{tr("Предмет")}</th>
                <th className="num">{tr("Сумма")}</th>
                <th className="num">{tr("Оплачено")}</th>
                <th className="num">{tr("Остаток")}</th>
                <th>{tr("Действует до")}</th>
                <th>{tr("Статус")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const paid = paidOf(c), rest = (c.amount ?? 0) - paid, d = daysTo(c.ends_on);
                return (
                  <tr key={c.id} className="is-click" onClick={() => setOpen(c)}>
                    <td>
                      <b>{c.counterparty}</b>
                      <div className="fin-sub">{c.direction === "income" ? tr("доходный") : tr("расходный")}{c.counterparty_bin ? ` · ${tr("БИН")} ${c.counterparty_bin}` : ""}</div>
                    </td>
                    <td>{companyName(companies, c.company_id)}</td>
                    <td>{c.number || "—"}<div className="fin-sub">{fmtDate(c.signed_on)}</div></td>
                    <td className="fin-wrap">{c.subject || "—"}</td>
                    <td className="num">{money(c.amount, c.currency)}</td>
                    <td className="num">{money(paid, c.currency)}</td>
                    <td className={`num${rest < 0 ? " is-bad" : ""}`}>{c.amount == null ? "—" : money(rest, c.currency)}</td>
                    <td className={d != null && d <= 30 && c.status === "active" ? "is-warn" : undefined}>{fmtDate(c.ends_on)}</td>
                    <td><span className={`fin-status st-${c.status}`}>{tr(STATUS[c.status])}</span></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{tr("Итого по списку")}</td>
                {(["amount", "paid", "rest"] as const).map((k) => (
                  <td key={k} className="num">
                    {Object.entries(byCurrency(list, (c) => (k === "amount" ? c.amount : k === "paid" ? paidOf(c) : (c.amount ?? 0) - paidOf(c)), (c) => c.currency)).map(([cur, v]) => (
                      <div key={cur}>{money(v, cur)}</div>
                    ))}
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {open && <ContractEditor contract={open === "new" ? null : open} payments={payments} companies={companies} edit={edit} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ContractEditor({ contract, payments, companies, edit, onClose }: { contract: FinContract | null; payments: FinPayment[]; companies: Co[]; edit: boolean; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    company_id: String(contract?.company_id ?? companies[0]?.id ?? ""),
    direction: contract?.direction ?? "expense",
    counterparty: contract?.counterparty ?? "",
    counterparty_bin: contract?.counterparty_bin ?? "",
    number: contract?.number ?? "",
    signed_on: contract?.signed_on ?? "",
    subject: contract?.subject ?? "",
    amount: contract?.amount != null ? String(contract.amount) : "",
    currency: contract?.currency ?? "KZT",
    starts_on: contract?.starts_on ?? "",
    ends_on: contract?.ends_on ?? "",
    status: contract?.status ?? "active",
    responsible: contract?.responsible ?? "",
    notes: contract?.notes ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const own = contract ? payments.filter((p) => p.contract_id === contract.id) : [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const supabase = createClient();
    const row: Record<string, unknown> = { ...clean(f, ["amount"]), company_id: f.company_id ? Number(f.company_id) : null, updated_at: new Date().toISOString() };
    if (file) {
      const path = `contracts/${Date.now()}-${file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const up = await uploadFile("finance", path, file);
      if (up.error) { setBusy(false); return setErr(errText(up.error)); }
      row.file_path = path;
      row.file_name = file.name;
    }
    const res = contract ? await supabase.from("fin_contracts").update(row).eq("id", contract.id) : await supabase.from("fin_contracts").insert({ ...row, created_by: await me() });
    setBusy(false);
    if (res.error) return setErr(errText(res.error.message));
    router.refresh();
    onClose();
  }
  async function remove() {
    if (!contract || !confirm(tr("Удалить договор с «{0}» и все его платежи?", { 0: contract.counterparty }))) return;
    const supabase = createClient();
    const { error } = await supabase.from("fin_contracts").delete().eq("id", contract.id);
    if (error) return setErr(errText(error.message));
    if (contract.file_path) await supabase.storage.from("finance").remove([contract.file_path]);
    router.refresh();
    onClose();
  }
  async function openFile() {
    if (!contract?.file_path) return;
    const { data } = await createClient().storage.from("finance").createSignedUrl(contract.file_path, 300);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <Modal title={contract ? tr("Договор с {0}", { 0: contract.counterparty }) : tr("Новый договор")} onClose={onClose} wide>
      <form onSubmit={save} className="fin-form">
        <fieldset disabled={!edit} className="fin-grid">
          <label className="field-label">{tr("Компания группы")}
            <select className="field" value={f.company_id} onChange={set("company_id")}>
              {companies.map((c) => <option key={c.id} value={c.id}>{companyName(companies, c.id)}</option>)}
            </select>
          </label>
          <label className="field-label">{tr("Вид договора")}
            <select className="field" value={f.direction} onChange={set("direction")}>
              <option value="expense">{tr("Расходный (платим мы)")}</option>
              <option value="income">{tr("Доходный (платят нам)")}</option>
            </select>
          </label>
          <label className="field-label">{tr("Контрагент")}<input className="field" required value={f.counterparty} onChange={set("counterparty")} /></label>
          <label className="field-label">{tr("БИН / ИИН контрагента")}<input className="field" inputMode="numeric" value={f.counterparty_bin} onChange={set("counterparty_bin")} /></label>
          <label className="field-label">{tr("Номер договора")}<input className="field" value={f.number} onChange={set("number")} /></label>
          <label className="field-label">{tr("Дата договора")}<input className="field" type="date" value={f.signed_on} onChange={set("signed_on")} /></label>
          <label className="field-label fin-span">{tr("Предмет")}<input className="field" value={f.subject} onChange={set("subject")} placeholder={tr("например, буровые работы на участке Байское")} /></label>
          <label className="field-label">{tr("Сумма договора")}<input className="field" inputMode="decimal" value={f.amount} onChange={set("amount")} /></label>
          <label className="field-label">{tr("Валюта")}
            <select className="field" value={f.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field-label">{tr("Начало")}<input className="field" type="date" value={f.starts_on} onChange={set("starts_on")} /></label>
          <label className="field-label">{tr("Действует до")}<input className="field" type="date" value={f.ends_on} onChange={set("ends_on")} /></label>
          <label className="field-label">{tr("Статус")}
            <select className="field" value={f.status} onChange={set("status")}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
            </select>
          </label>
          <label className="field-label">{tr("Ответственный")}<input className="field" list="staff-names" value={f.responsible} onChange={set("responsible")} /></label>
          <label className="field-label fin-span">{tr("Примечания")}<textarea className="field" rows={2} value={f.notes} onChange={set("notes")} /></label>
          <label className="field-label fin-span">{tr("Скан договора (PDF)")}
            <input className="field" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </fieldset>
        {contract?.file_path && <Row><Button variant="tertiary" size="s" prefixIcon="document" onClick={openFile}>{contract.file_name ?? tr("Открыть скан")}</Button></Row>}
        {err && <Text variant="body-default-s" onBackground="danger-strong" role="alert">{err}</Text>}
        {edit && (
          <Row gap="8" wrap>
            <Button type="submit" loading={busy} prefixIcon="check">{tr("Сохранить")}</Button>
            {contract && <Button type="button" variant="danger" size="m" onClick={remove}>{tr("Удалить договор")}</Button>}
          </Row>
        )}
      </form>
      {contract && <Payments contract={contract} list={own} edit={edit} />}
    </Modal>
  );
}

function Payments({ contract, list, edit }: { contract: FinContract; list: FinPayment[]; edit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ pay_date: new Date().toISOString().slice(0, 10), amount: "", planned: false, description: "" });
  const [err, setErr] = useState("");
  const dir = contract.direction === "income" ? "in" : "out";
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(f.amount.replace(/\s/g, "").replace(",", "."));
    if (!amount) return;
    const { error } = await createClient().from("fin_payments").insert({
      contract_id: contract.id, company_id: contract.company_id, direction: dir, amount, currency: contract.currency,
      pay_date: f.pay_date, planned: f.planned, counterparty: contract.counterparty, description: f.description || null, created_by: await me(),
    });
    if (error) return setErr(errText(error.message));
    setF({ ...f, amount: "", description: "" });
    router.refresh();
  }
  async function markPaid(p: FinPayment) {
    const { error } = await createClient().from("fin_payments").update({ planned: false, pay_date: new Date().toISOString().slice(0, 10) }).eq("id", p.id);
    if (error) return setErr(errText(error.message));
    router.refresh();
  }
  async function del(p: FinPayment) {
    if (!confirm(tr("Удалить платёж на {0}?", { 0: money(p.amount, p.currency) }))) return;
    const { error } = await createClient().from("fin_payments").delete().eq("id", p.id);
    if (error) return setErr(errText(error.message));
    router.refresh();
  }
  return (
    <div className="fin-payments">
      <h3>{tr("Платежи по договору")}</h3>
      {list.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Платежей пока нет. Добавьте сделанные оплаты и график будущих.")}</Text>
      ) : (
        <table className="data-table fin-table">
          <thead><tr><th>{tr("Дата")}</th><th className="num">{tr("Сумма")}</th><th>{tr("Вид")}</th><th>{tr("Назначение")}</th>{edit && <th />}</tr></thead>
          <tbody>
            {list.map((p) => {
              const d = daysTo(p.pay_date);
              return (
                <tr key={p.id} className={p.planned && d != null && d < 0 ? "is-overdue" : undefined}>
                  <td>{fmtDate(p.pay_date)}</td>
                  <td className="num">{money(p.amount, p.currency)}</td>
                  <td>{p.planned ? <span className="fin-status st-draft">{d != null && d < 0 ? tr("просрочен") : tr("по графику")}</span> : <span className="fin-status st-active">{tr("оплачен")}</span>}</td>
                  <td className="fin-wrap">{p.description || "—"}</td>
                  {edit && (
                    <td>
                      <Row gap="4">
                        {p.planned && <Button size="s" variant="secondary" onClick={() => markPaid(p)}>{tr("Оплачен")}</Button>}
                        <Button size="s" variant="tertiary" onClick={() => del(p)}>{tr("Удалить")}</Button>
                      </Row>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {edit && (
        <form onSubmit={add} className="fin-inline">
          <input className="field" type="date" value={f.pay_date} onChange={(e) => setF({ ...f, pay_date: e.target.value })} aria-label={tr("Дата")} required />
          <input className="field" inputMode="decimal" placeholder={tr("Сумма, {0}", { 0: contract.currency })} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
          <input className="field" placeholder={tr("Назначение (необязательно)")} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <label className="fin-check"><input type="checkbox" checked={f.planned} onChange={(e) => setF({ ...f, planned: e.target.checked })} /> {tr("будущий, по графику")}</label>
          <Button type="submit" size="s" prefixIcon="plus">{tr("Платёж")}</Button>
        </form>
      )}
      {err && <Text variant="body-default-s" onBackground="danger-strong" role="alert">{err}</Text>}
    </div>
  );
}
