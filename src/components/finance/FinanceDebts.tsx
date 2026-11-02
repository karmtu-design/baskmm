"use client";

// Дебиторка и кредиторка: who owes the group and whom the group owes, by how many days overdue.
// Balances can be typed in or loaded from an Excel report out of 1C (any column order: the columns are matched once).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Row, SegmentedControl, Text } from "@once-ui-system/core";
import { tr } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES, byCurrency, daysTo, fmtDate, money, sum, toKzt } from "@/lib/money";
import type { FinDebt, KztRates } from "@/lib/finance";
import { Modal, Tiles, clean, companyName, errText, me } from "./ui";

type Co = { id: number; name: string };
const BUCKETS = [
  { id: "ok", label: "в срок", test: (d: number | null) => d == null || d >= 0 },
  { id: "30", label: "просрочка до 30 дн.", test: (d: number | null) => d != null && d < 0 && d >= -30 },
  { id: "90", label: "31–90 дн.", test: (d: number | null) => d != null && d < -30 && d >= -90 },
  { id: "90+", label: "больше 90 дн.", test: (d: number | null) => d != null && d < -90 },
];

export default function FinanceDebts({ debts, companies, rates, edit }: { debts: FinDebt[]; companies: Co[]; rates: KztRates; edit: boolean }) {
  const [kind, setKind] = useState<FinDebt["kind"]>("receivable");
  const [co, setCo] = useState("");
  const [bucket, setBucket] = useState("");
  const [open, setOpen] = useState<FinDebt | "new" | null>(null);
  const [imp, setImp] = useState(false);
  const own = debts.filter((d) => d.kind === kind && (!co || String(d.company_id) === co));
  const list = useMemo(() => own.filter((d) => !bucket || BUCKETS.find((b) => b.id === bucket)!.test(daysTo(d.due_on))), [own, bucket]);
  const kzt = (rows: FinDebt[]) => sum(rows.map((d) => toKzt(d.amount, d.currency, rates) ?? 0));
  const tone = (id: string) => (id === "ok" ? undefined : id === "30" ? ("warn" as const) : ("bad" as const));

  return (
    <div className="fin-stack">
      <Row gap="12" wrap vertical="center">
        <SegmentedControl
          value={kind}
          onChange={(v) => setKind(v as FinDebt["kind"])}
          buttons={[{ value: "receivable", label: tr("Нам должны") }, { value: "payable", label: tr("Мы должны") }]}
        />
        <select className="field" style={{ maxWidth: 280 }} value={co} onChange={(e) => setCo(e.target.value)} aria-label={tr("Компания")}>
          <option value="">{tr("Все компании")}</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{companyName(companies, c.id)}</option>)}
        </select>
        {edit && <Button prefixIcon="plus" onClick={() => setOpen("new")}>{tr("Запись")}</Button>}
        {edit && <Button variant="secondary" prefixIcon="upload" onClick={() => setImp(true)}>{tr("Загрузить из Excel (1С)")}</Button>}
      </Row>
      <Tiles
        items={[
          { label: kind === "receivable" ? tr("Всего нам должны") : tr("Всего мы должны"), value: money(kzt(own)), hint: tr("в тенге по курсу НБ РК") },
          ...BUCKETS.map((b) => {
            const rows = own.filter((d) => b.test(daysTo(d.due_on)));
            return { label: tr(b.label), value: money(kzt(rows)), hint: tr("{0} записей", { 0: rows.length }), tone: rows.length ? tone(b.id) : undefined };
          }),
        ]}
      />
      <Row gap="4" wrap>
        {[{ id: "", label: "все" }, ...BUCKETS].map((b) => (
          <button key={b.id} type="button" className={`chip${bucket === b.id ? " is-on" : ""}`} onClick={() => setBucket(b.id)}>{tr(b.label)}</button>
        ))}
      </Row>
      {list.length === 0 ? (
        <Text onBackground="neutral-weak">{tr("Записей нет.")}</Text>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table fin-table">
            <thead>
              <tr><th>{tr("Контрагент")}</th><th>{tr("Компания группы")}</th><th>{tr("Основание")}</th><th className="num">{tr("Сумма")}</th><th>{tr("Срок оплаты")}</th><th>{tr("Просрочка")}</th><th>{tr("Источник")}</th></tr>
            </thead>
            <tbody>
              {[...list].sort((a, b) => (daysTo(a.due_on) ?? 9e9) - (daysTo(b.due_on) ?? 9e9)).map((d) => {
                const days = daysTo(d.due_on);
                return (
                  <tr key={d.id} className="is-click" onClick={() => setOpen(d)}>
                    <td><b>{d.counterparty}</b>{d.counterparty_bin && <div className="fin-sub">{tr("БИН")} {d.counterparty_bin}</div>}</td>
                    <td>{companyName(companies, d.company_id)}</td>
                    <td className="fin-wrap">{d.basis || "—"}</td>
                    <td className="num">{money(d.amount, d.currency)}</td>
                    <td>{fmtDate(d.due_on)}</td>
                    <td className={days != null && days < -30 ? "is-bad" : days != null && days < 0 ? "is-warn" : undefined}>{days != null && days < 0 ? tr("{0} дн.", { 0: -days }) : "—"}</td>
                    <td className="fin-sub">{d.source === "1С" ? tr("1С, на {0}", { 0: fmtDate(d.as_of) }) : tr("вручную")}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>{tr("Итого")}</td><td className="num">{Object.entries(byCurrency(list, (d) => d.amount, (d) => d.currency)).map(([c, v]) => <div key={c}>{money(v, c)}</div>)}</td><td colSpan={3} /></tr>
            </tfoot>
          </table>
        </div>
      )}
      {open && <DebtEditor debt={open === "new" ? null : open} kind={kind} companies={companies} edit={edit} onClose={() => setOpen(null)} />}
      {imp && <DebtImport kind={kind} companies={companies} onClose={() => setImp(false)} />}
    </div>
  );
}

function DebtEditor({ debt, kind, companies, edit, onClose }: { debt: FinDebt | null; kind: FinDebt["kind"]; companies: Co[]; edit: boolean; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    company_id: String(debt?.company_id ?? companies[0]?.id ?? ""),
    kind: debt?.kind ?? kind,
    counterparty: debt?.counterparty ?? "",
    counterparty_bin: debt?.counterparty_bin ?? "",
    amount: debt ? String(debt.amount) : "",
    currency: debt?.currency ?? "KZT",
    due_on: debt?.due_on ?? "",
    basis: debt?.basis ?? "",
    note: debt?.note ?? "",
  });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = { ...clean(f, ["amount"]), company_id: f.company_id ? Number(f.company_id) : null };
    const supabase = createClient();
    const res = debt ? await supabase.from("fin_debts").update(row).eq("id", debt.id) : await supabase.from("fin_debts").insert({ ...row, source: "manual", created_by: await me() });
    if (res.error) return setErr(errText(res.error.message));
    router.refresh();
    onClose();
  }
  async function remove() {
    if (!debt || !confirm(tr("Удалить запись?"))) return;
    const { error } = await createClient().from("fin_debts").delete().eq("id", debt.id);
    if (error) return setErr(errText(error.message));
    router.refresh();
    onClose();
  }
  return (
    <Modal title={debt ? debt.counterparty : tr("Новая запись")} onClose={onClose}>
      <form onSubmit={save} className="fin-form">
        <fieldset disabled={!edit} className="fin-grid">
          <label className="field-label">{tr("Вид")}
            <select className="field" value={f.kind} onChange={set("kind")}><option value="receivable">{tr("Нам должны")}</option><option value="payable">{tr("Мы должны")}</option></select>
          </label>
          <label className="field-label">{tr("Компания группы")}
            <select className="field" value={f.company_id} onChange={set("company_id")}>{companies.map((c) => <option key={c.id} value={c.id}>{companyName(companies, c.id)}</option>)}</select>
          </label>
          <label className="field-label">{tr("Контрагент")}<input className="field" required value={f.counterparty} onChange={set("counterparty")} /></label>
          <label className="field-label">{tr("БИН / ИИН")}<input className="field" inputMode="numeric" value={f.counterparty_bin} onChange={set("counterparty_bin")} /></label>
          <label className="field-label">{tr("Сумма")}<input className="field" inputMode="decimal" required value={f.amount} onChange={set("amount")} /></label>
          <label className="field-label">{tr("Валюта")}<select className="field" value={f.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field-label">{tr("Срок оплаты")}<input className="field" type="date" value={f.due_on} onChange={set("due_on")} /></label>
          <label className="field-label">{tr("Основание (счёт, акт, договор)")}<input className="field" value={f.basis} onChange={set("basis")} /></label>
          <label className="field-label fin-span">{tr("Комментарий")}<textarea className="field" rows={2} value={f.note} onChange={set("note")} /></label>
        </fieldset>
        {err && <Text variant="body-default-s" onBackground="danger-strong" role="alert">{err}</Text>}
        {edit && (
          <Row gap="8">
            <Button type="submit" prefixIcon="check">{tr("Сохранить")}</Button>
            {debt && <Button type="button" variant="danger" onClick={remove}>{tr("Удалить")}</Button>}
          </Row>
        )}
      </form>
    </Modal>
  );
}

// ---------- loading balances from an Excel report ----------
type Sheet = { header: string[]; rows: unknown[][] };
const FIELDS = [
  { key: "counterparty", label: "Контрагент", need: true, guess: /контраг|наимен|покуп|поставщ|организ/i },
  { key: "counterparty_bin", label: "БИН / ИИН", need: false, guess: /бин|иин|bin/i },
  { key: "amount", label: "Сумма долга", need: true, guess: /сальдо|сумм|долг|остат|кон/i },
  { key: "due_on", label: "Срок оплаты", need: false, guess: /срок|оплат|дата/i },
  { key: "basis", label: "Основание", need: false, guess: /основ|документ|счет|счёт|договор/i },
] as const;

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if (o.text) return String(o.text);
    if (o.result != null) return cellText(o.result);
  }
  return String(v).trim();
}
function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  const s = cellText(v).replace(/\s| /g, "").replace(",", ".");
  const n = Number(s);
  return s && !Number.isNaN(n) ? n : null;
}
function toDate(v: unknown) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = cellText(v);
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function DebtImport({ kind, companies, onClose }: { kind: FinDebt["kind"]; companies: Co[]; onClose: () => void }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [k, setK] = useState(kind);
  const [co, setCo] = useState(String(companies[0]?.id ?? ""));
  const [cur, setCur] = useState("KZT");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [replace, setReplace] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(file: File) {
    setMsg(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const all: unknown[][] = [];
      ws.eachRow({ includeEmpty: false }, (r) => all.push((r.values as unknown[]).slice(1)));
      // the header is the first row with at least two text cells
      const hi = all.findIndex((r) => r.filter((c) => cellText(c) && Number.isNaN(Number(cellText(c)))).length >= 2);
      if (hi < 0) throw new Error(tr("не найдена строка с названиями столбцов"));
      const header = all[hi].map(cellText);
      const rows = all.slice(hi + 1).filter((r) => r.some((c) => cellText(c)));
      const guess: Record<string, number> = {};
      for (const fd of FIELDS) { const i = header.findIndex((h, j) => fd.guess.test(h) && !Object.values(guess).includes(j)); if (i >= 0) guess[fd.key] = i; }
      setSheet({ header, rows });
      setMap(guess);
    } catch (e) {
      setMsg({ ok: false, text: tr("Файл не открылся как таблица Excel (.xlsx): {0}", { 0: (e as Error).message }) });
    }
  }
  const parsed = useMemo(() => {
    if (!sheet || map.counterparty == null || map.amount == null) return [];
    return sheet.rows
      .map((r) => ({
        counterparty: cellText(r[map.counterparty]),
        counterparty_bin: map.counterparty_bin != null ? cellText(r[map.counterparty_bin]).replace(/\D/g, "") || null : null,
        amount: toNumber(r[map.amount]),
        due_on: map.due_on != null ? toDate(r[map.due_on]) : null,
        basis: map.basis != null ? cellText(r[map.basis]) || null : null,
      }))
      .filter((r) => r.counterparty && r.amount && !/^итог|^всего/i.test(r.counterparty));
  }, [sheet, map]);

  async function save() {
    setBusy(true);
    const supabase = createClient();
    if (replace) {
      const { error } = await supabase.from("fin_debts").delete().eq("company_id", Number(co)).eq("kind", k).eq("source", "1С");
      if (error) { setBusy(false); return setMsg({ ok: false, text: errText(error.message) }); }
    }
    const who = await me();
    const { error } = await supabase.from("fin_debts").insert(parsed.map((r) => ({ ...r, amount: Math.abs(r.amount!), kind: k, company_id: Number(co), currency: cur, as_of: asOf, source: "1С", created_by: who })));
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errText(error.message) });
    router.refresh();
    onClose();
  }

  return (
    <Modal title={tr("Загрузка из Excel")} onClose={onClose} wide>
      <div className="fin-form">
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Сформируйте в 1С отчёт по расчётам с контрагентами (например, «Анализ счёта» или «Оборотно-сальдовая ведомость по счёту» с разбивкой по контрагентам), сохраните его как Excel (.xlsx) и выберите здесь. Столбцы сопоставляются один раз, порядок может быть любым.")}</Text>
        <input className="field" type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        {sheet && (
          <>
            <div className="fin-grid">
              <label className="field-label">{tr("Что загружаем")}
                <select className="field" value={k} onChange={(e) => setK(e.target.value as FinDebt["kind"])}><option value="receivable">{tr("Нам должны (дебиторка)")}</option><option value="payable">{tr("Мы должны (кредиторка)")}</option></select>
              </label>
              <label className="field-label">{tr("Компания группы")}
                <select className="field" value={co} onChange={(e) => setCo(e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{companyName(companies, c.id)}</option>)}</select>
              </label>
              <label className="field-label">{tr("Валюта сумм")}<select className="field" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field-label">{tr("Данные на дату")}<input className="field" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
              {FIELDS.map((fd) => (
                <label key={fd.key} className="field-label">{tr(fd.label)}{fd.need ? " *" : ""}
                  <select className="field" value={map[fd.key] ?? ""} onChange={(e) => setMap({ ...map, [fd.key]: e.target.value === "" ? (undefined as unknown as number) : Number(e.target.value) })}>
                    <option value="">{fd.need ? tr("— выберите столбец —") : tr("— нет в файле —")}</option>
                    {sheet.header.map((h, i) => <option key={i} value={i}>{h || tr("столбец {0}", { 0: i + 1 })}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <label className="fin-check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> {tr("Заменить прежнюю выгрузку из 1С по этой компании (записи, внесённые вручную, останутся)")}</label>
            <Text variant="body-default-s">{tr("Будет загружено строк: {0}", { 0: parsed.length })}{parsed.length > 0 && ` · ${tr("итого")} ${money(sum(parsed.map((r) => Math.abs(r.amount!))), cur)}`}</Text>
            {parsed.length > 0 && (
              <table className="data-table fin-table">
                <thead><tr><th>{tr("Контрагент")}</th><th>{tr("БИН")}</th><th className="num">{tr("Сумма")}</th><th>{tr("Срок")}</th><th>{tr("Основание")}</th></tr></thead>
                <tbody>{parsed.slice(0, 6).map((r, i) => <tr key={i}><td>{r.counterparty}</td><td>{r.counterparty_bin ?? "—"}</td><td className="num">{money(Math.abs(r.amount!), cur)}</td><td>{fmtDate(r.due_on)}</td><td>{r.basis ?? "—"}</td></tr>)}</tbody>
              </table>
            )}
            <Row><Button onClick={save} loading={busy} disabled={!parsed.length} prefixIcon="check">{tr("Загрузить")}</Button></Row>
          </>
        )}
        {msg && <Text variant="body-default-s" onBackground={msg.ok ? "success-strong" : "danger-strong"} role="status">{msg.text}</Text>}
      </div>
    </Modal>
  );
}
