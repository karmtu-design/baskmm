// The «Финансы» section: data for people the administrator let in (the database checks it too).
import { createClient } from "@/lib/supabase/server";

export type FinRole = "admin" | "view" | "edit" | "cfo" | "head" | "accountant";
export type FinContract = {
  id: number;
  company_id: number | null;
  direction: "expense" | "income";
  counterparty: string;
  counterparty_bin: string | null;
  number: string | null;
  signed_on: string | null;
  subject: string | null;
  amount: number | null;
  currency: string;
  starts_on: string | null;
  ends_on: string | null;
  status: "draft" | "active" | "closed" | "terminated";
  responsible: string | null;
  notes: string | null;
  file_name: string | null;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
};
export type FinPayment = {
  id: number;
  contract_id: number | null;
  company_id: number | null;
  direction: "out" | "in";
  amount: number;
  currency: string;
  pay_date: string;
  planned: boolean;
  article: string | null;
  counterparty: string | null;
  description: string | null;
  source: string;
  created_by: string | null;
};
export type FinLoan = {
  id: number;
  lender_id: number | null;
  borrower_id: number | null;
  number: string | null;
  signed_on: string | null;
  principal: number;
  currency: string;
  rate: number;
  due_on: string | null;
  notes: string | null;
};
export type FinLoanMove = { id: number; loan_id: number; moved_on: string; kind: "issue" | "repay" | "interest"; amount: number; note: string | null };
export type FinDebt = {
  id: number;
  company_id: number | null;
  kind: "receivable" | "payable";
  counterparty: string;
  counterparty_bin: string | null;
  amount: number;
  currency: string;
  due_on: string | null;
  basis: string | null;
  as_of: string | null;
  source: string;
  note: string | null;
};
/** Tenge per one unit of each currency (official rate of the National Bank). */
export type KztRates = Record<string, number>;

export async function finRole(): Promise<FinRole | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fin_role");
  return (data as FinRole | null) ?? null;
}
export const canEditFinance = (r: FinRole | null) => !!r && r !== "view";

export async function kztRates(): Promise<KztRates> {
  const { getRates } = await import("./data");
  const r = await getRates();
  const out: KztRates = { KZT: 1 };
  for (const x of r?.rates ?? []) out[x.code] = x.rate / (x.per || 1);
  return out;
}

export async function getFinanceBasics() {
  const supabase = await createClient();
  const [c, p, l, m, d, co] = await Promise.all([
    supabase.from("fin_contracts").select("*").order("signed_on", { ascending: false, nullsFirst: false }).order("id", { ascending: false }),
    supabase.from("fin_payments").select("*").order("pay_date"),
    supabase.from("fin_loans").select("*").order("signed_on", { ascending: false, nullsFirst: false }),
    supabase.from("fin_loan_moves").select("*").order("moved_on"),
    supabase.from("fin_debts").select("*").order("due_on", { nullsFirst: false }),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  return {
    contracts: (c.data ?? []) as FinContract[],
    payments: (p.data ?? []) as FinPayment[],
    loans: (l.data ?? []) as FinLoan[],
    moves: (m.data ?? []) as FinLoanMove[],
    debts: (d.data ?? []) as FinDebt[],
    companies: (co.data ?? []) as { id: number; name: string }[],
  };
}
