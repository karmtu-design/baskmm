"use client";

// Займы внутри группы: who lent whom, how much is still owed, the interest built up, and the net picture.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Row, Text } from "@once-ui-system/core";
import { tr } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES, daysTo, fmtDate, money, sum, toKzt } from "@/lib/money";
import type { FinLoan, FinLoanMove, KztRates } from "@/lib/finance";
import { Modal, Tiles, clean, companyName, errText, me } from "./ui";

type Co = { id: number; name: string };
const KIND: Record<FinLoanMove["kind"], string> = { issue: "выдача", repay: "возврат долга", interest: "оплата процентов" };

/** Balance and the interest built up (simple interest on the balance, day by day, rate per year). */
export function loanState(l: FinLoan, moves: FinLoanMove[], today = new Date()) {
  const own = moves.filter((m) => m.loan_id === l.id).sort((a, b) => a.moved_on.localeCompare(b.moved_on));
  const issued = sum(own.filter((m) => m.kind === "issue").map((m) => m.amount));
  const repaid = sum(own.filter((m) => m.kind === "repay").map((m) => m.amount));
  const interestPaid = sum(own.filter((m) => m.kind === "interest").map((m) => m.amount));
  let bal = 0, acc = 0, last: Date | null = null;
  const step = (to: Date) => {
    if (last) acc += (bal * (Number(l.rate) / 100) * Math.max(0, (to.getTime() - last.getTime()) / 864e5)) / 365;
    last = to;
  };
  for (const m of own) {
    step(new Date(m.moved_on + "T00:00:00"));
    if (m.kind === "issue") bal += Number(m.amount);
    if (m.kind === "repay") bal -= Number(m.amount);
  }
  step(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const balance = Math.round((issued - repaid) * 100) / 100;
  return { issued, repaid, balance, interest: Math.round(acc * 100) / 100, interestPaid, interestDue: Math.max(0, Math.round((acc - interestPaid) * 100) / 100) };
}

export default function FinanceLoans({ loans, moves, companies, rates, edit }: { loans: FinLoan[]; moves: FinLoanMove[]; companies: Co[]; rates: KztRates; edit: boolean }) {
  const [open, setOpen] = useState<FinLoan | "new" | null>(null);
  const st = new Map(loans.map((l) => [l.id, loanState(l, moves)]));
  const totalKzt = sum(loans.map((l) => toKzt(st.get(l.id)!.balance, l.currency, rates) ?? 0));
  const interestKzt = sum(loans.map((l) => toKzt(st.get(l.id)!.interestDue, l.currency, rates) ?? 0));
  const overdue = loans.filter((l) => st.get(l.id)!.balance > 0 && (daysTo(l.due_on) ?? 1) < 0);

  // net debt between each pair of companies, in tenge
  const pairs = new Map<string, { a: number; b: number; v: number }>();
  for (const l of loans) {
    if (l.lender_id == null || l.borrower_id == null) continue;
    const v = toKzt(st.get(l.id)!.balance + st.get(l.id)!.interestDue, l.currency, rates) ?? 0;
    const [a, b] = l.lender_id < l.borrower_id ? [l.lender_id, l.borrower_id] : [l.borrower_id, l.lender_id];
    const key = `${a}-${b}`, cur = pairs.get(key) ?? { a, b, v: 0 };
    cur.v += l.lender_id === a ? v : -v; // positive: b owes a
    pairs.set(key, cur);
  }
  const net = [...pairs.values()].filter((p) => Math.abs(p.v) >= 0.01);

  return (
    <div className="fin-stack">
      <Tiles
        items={[
          { label: tr("Займов"), value: loans.length },
          { label: tr("Общий остаток долга"), value: money(totalKzt), hint: tr("в тенге по курсу НБ РК") },
          { label: tr("Начисленные и не оплаченные проценты"), value: money(interestKzt), hint: tr("расчёт по ставке договора, на сегодня") },
          { label: tr("Просрочены"), value: overdue.length, tone: overdue.length ? "bad" : undefined },
        ]}
      />
      {net.length > 0 && (
        <div className="fin-net">
          <h3>{tr("Кто кому должен (с учётом встречных займов)")}</h3>
          {net.map((p) => {
            const [debtor, creditor] = p.v > 0 ? [p.b, p.a] : [p.a, p.b];
            return (
              <div key={`${p.a}-${p.b}`} className="fin-net-row">
                <b>{companyName(companies, debtor)}</b> <span>{tr("должна")}</span> <b>{companyName(companies, creditor)}</b>
                <span className="num">{money(Math.abs(p.v))}</span>
              </div>
            );
          })}
        </div>
      )}
      <Row horizontal="between" vertical="center" wrap gap="8">
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Проценты считаются простыми: остаток долга × ставка × дни / 365. Сверяйте с бухгалтерией.")}</Text>
        {edit && <Button prefixIcon="plus" onClick={() => setOpen("new")}>{tr("Займ")}</Button>}
      </Row>
      {loans.length === 0 ? (
        <Text onBackground="neutral-weak">{tr("Займов пока нет.")}</Text>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table fin-table">
            <thead>
              <tr>
                <th>{tr("Заимодавец → заёмщик")}</th><th>{tr("Договор")}</th><th className="num">{tr("Ставка")}</th>
                <th className="num">{tr("Выдано")}</th><th className="num">{tr("Возвращено")}</th><th className="num">{tr("Остаток долга")}</th>
                <th className="num">{tr("Проценты к оплате")}</th><th>{tr("Срок возврата")}</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const s = st.get(l.id)!, d = daysTo(l.due_on);
                return (
                  <tr key={l.id} className="is-click" onClick={() => setOpen(l)}>
                    <td><b>{companyName(companies, l.lender_id)}</b> → <b>{companyName(companies, l.borrower_id)}</b></td>
                    <td>{l.number || "—"}<div className="fin-sub">{fmtDate(l.signed_on)}</div></td>
                    <td className="num">{Number(l.rate)}%</td>
                    <td className="num">{money(s.issued, l.currency)}</td>
                    <td className="num">{money(s.repaid, l.currency)}</td>
                    <td className="num"><b>{money(s.balance, l.currency)}</b></td>
                    <td className="num">{money(s.interestDue, l.currency)}</td>
                    <td className={s.balance > 0 && d != null && d < 0 ? "is-bad" : s.balance > 0 && d != null && d <= 30 ? "is-warn" : undefined}>{fmtDate(l.due_on)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && <LoanEditor loan={open === "new" ? null : open} moves={moves} companies={companies} edit={edit} onClose={() => setOpen(null)} />}
    </div>
  );
}

function LoanEditor({ loan, moves, companies, edit, onClose }: { loan: FinLoan | null; moves: FinLoanMove[]; companies: Co[]; edit: boolean; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    lender_id: String(loan?.lender_id ?? companies[0]?.id ?? ""),
    borrower_id: String(loan?.borrower_id ?? companies[1]?.id ?? ""),
    number: loan?.number ?? "",
    signed_on: loan?.signed_on ?? "",
    principal: loan ? String(loan.principal) : "",
    currency: loan?.currency ?? "KZT",
    rate: loan ? String(loan.rate) : "0",
    due_on: loan?.due_on ?? "",
    notes: loan?.notes ?? "",
  });
  const [m, setM] = useState({ moved_on: new Date().toISOString().slice(0, 10), kind: "issue", amount: "", note: "" });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const own = loan ? moves.filter((x) => x.loan_id === loan.id) : [];
  const s = loan ? loanState(loan, moves) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.lender_id === f.borrower_id) return setErr(tr("Заимодавец и заёмщик должны быть разными компаниями."));
    const row = { ...clean(f, ["principal", "rate"]), lender_id: Number(f.lender_id), borrower_id: Number(f.borrower_id) };
    const supabase = createClient();
    const res = loan ? await supabase.from("fin_loans").update(row).eq("id", loan.id) : await supabase.from("fin_loans").insert({ ...row, created_by: await me() });
    if (res.error) return setErr(errText(res.error.message));
    router.refresh();
    onClose();
  }
  async function addMove(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(m.amount.replace(/\s/g, "").replace(",", "."));
    if (!loan || !amount) return;
    const { error } = await createClient().from("fin_loan_moves").insert({ loan_id: loan.id, moved_on: m.moved_on, kind: m.kind, amount, note: m.note || null, created_by: await me() });
    if (error) return setErr(errText(error.message));
    setM({ ...m, amount: "", note: "" });
    router.refresh();
  }
  async function delMove(id: number) {
    if (!confirm(tr("Удалить эту операцию?"))) return;
    const { error } = await createClient().from("fin_loan_moves").delete().eq("id", id);
    if (error) return setErr(errText(error.message));
    router.refresh();
  }
  async function remove() {
    if (!loan || !confirm(tr("Удалить займ со всеми операциями?"))) return;
    const { error } = await createClient().from("fin_loans").delete().eq("id", loan.id);
    if (error) return setErr(errText(error.message));
    router.refresh();
    onClose();
  }

  return (
    <Modal title={loan ? tr("Займ {0} → {1}", { 0: companyName(companies, loan.lender_id), 1: companyName(companies, loan.borrower_id) }) : tr("Новый займ")} onClose={onClose} wide>
      <form onSubmit={save} className="fin-form">
        <fieldset disabled={!edit} className="fin-grid">
          <label className="field-label">{tr("Заимодавец (даёт деньги)")}
            <select className="field" value={f.lender_id} onChange={set("lender_id")}>{companies.map((c) => <option key={c.id} value={c.id}>{companyName(companies, c.id)}</option>)}</select>
          </label>
          <label className="field-label">{tr("Заёмщик (получает)")}
            <select className="field" value={f.borrower_id} onChange={set("borrower_id")}>{companies.map((c) => <option key={c.id} value={c.id}>{companyName(companies, c.id)}</option>)}</select>
          </label>
          <label className="field-label">{tr("Номер договора займа")}<input className="field" value={f.number} onChange={set("number")} /></label>
          <label className="field-label">{tr("Дата договора")}<input className="field" type="date" value={f.signed_on} onChange={set("signed_on")} /></label>
          <label className="field-label">{tr("Сумма по договору")}<input className="field" inputMode="decimal" required value={f.principal} onChange={set("principal")} /></label>
          <label className="field-label">{tr("Валюта")}<select className="field" value={f.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field-label">{tr("Ставка, % годовых")}<input className="field" inputMode="decimal" value={f.rate} onChange={set("rate")} /></label>
          <label className="field-label">{tr("Срок возврата")}<input className="field" type="date" value={f.due_on} onChange={set("due_on")} /></label>
          <label className="field-label fin-span">{tr("Примечания")}<textarea className="field" rows={2} value={f.notes} onChange={set("notes")} /></label>
        </fieldset>
        {err && <Text variant="body-default-s" onBackground="danger-strong" role="alert">{err}</Text>}
        {edit && (
          <Row gap="8" wrap>
            <Button type="submit" prefixIcon="check">{tr("Сохранить")}</Button>
            {loan && <Button type="button" variant="danger" onClick={remove}>{tr("Удалить займ")}</Button>}
          </Row>
        )}
      </form>
      {loan && s && (
        <div className="fin-payments">
          <h3>{tr("Операции по займу")}</h3>
          <Text variant="body-default-s" onBackground="neutral-weak">
            {tr("Остаток долга {0}, начислено процентов {1}, оплачено процентов {2}.", { 0: money(s.balance, loan.currency), 1: money(s.interest, loan.currency), 2: money(s.interestPaid, loan.currency) })}
          </Text>
          {own.length > 0 && (
            <table className="data-table fin-table">
              <thead><tr><th>{tr("Дата")}</th><th>{tr("Операция")}</th><th className="num">{tr("Сумма")}</th><th>{tr("Комментарий")}</th>{edit && <th />}</tr></thead>
              <tbody>
                {own.map((x) => (
                  <tr key={x.id}>
                    <td>{fmtDate(x.moved_on)}</td><td>{tr(KIND[x.kind])}</td><td className="num">{money(x.amount, loan.currency)}</td><td className="fin-wrap">{x.note || "—"}</td>
                    {edit && <td><Button size="s" variant="tertiary" onClick={() => delMove(x.id)}>{tr("Удалить")}</Button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {edit && (
            <form onSubmit={addMove} className="fin-inline">
              <input className="field" type="date" value={m.moved_on} onChange={(e) => setM({ ...m, moved_on: e.target.value })} aria-label={tr("Дата")} required />
              <select className="field" value={m.kind} onChange={(e) => setM({ ...m, kind: e.target.value })} aria-label={tr("Операция")}>
                {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
              </select>
              <input className="field" inputMode="decimal" placeholder={tr("Сумма, {0}", { 0: loan.currency })} value={m.amount} onChange={(e) => setM({ ...m, amount: e.target.value })} required />
              <input className="field" placeholder={tr("Комментарий")} value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} />
              <Button type="submit" size="s" prefixIcon="plus">{tr("Операция")}</Button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
