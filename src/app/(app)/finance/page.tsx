import { tr } from "@/i18n";
import Link from "next/link";
import { Row, Text } from "@once-ui-system/core";
import { PageHeader } from "@/components/ui";
import { canEditFinance, finRole, getFinanceBasics, kztRates } from "@/lib/finance";
import FinanceContracts from "@/components/finance/FinanceContracts";
import FinanceLoans from "@/components/finance/FinanceLoans";
import FinanceDebts from "@/components/finance/FinanceDebts";

const TABS = [
  { id: "contracts", label: "Договоры" },
  { id: "loans", label: "Займы группы" },
  { id: "debts", label: "Дебиторка и кредиторка" },
];

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.some((t) => t.id === raw) ? raw! : "contracts";
  const role = await finRole();

  if (!role)
    return (
      <>
        <PageHeader title={tr("Финансы")} />
        <div className="founding-locked">
          <span aria-hidden>🔒</span>
          <Text variant="heading-strong-s">{tr("Нет доступа к финансам")}</Text>
          <Text variant="body-default-s" onBackground="neutral-weak">
            {tr("Раздел закрыт. Доступ открывает администратор на странице «Сотрудники».")}
          </Text>
        </div>
      </>
    );

  const [data, rates] = await Promise.all([getFinanceBasics(), kztRates()]);
  const edit = canEditFinance(role);
  return (
    <>
      <PageHeader title={tr("Финансы")} subtitle={tr("Договоры, займы и расчёты с контрагентами по всем компаниям группы. Закрытый раздел.")} />
      <Row as="nav" gap="4" marginBottom="24" borderBottom overflowX="auto" aria-label={tr("Разделы финансов")} className="tab-row">
        {TABS.map((t) => (
          <Link key={t.id} href={`/finance?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined} className="tab-link">
            {tr(t.label)}
          </Link>
        ))}
      </Row>
      {tab === "contracts" && <FinanceContracts contracts={data.contracts} payments={data.payments} companies={data.companies} rates={rates} edit={edit} />}
      {tab === "loans" && <FinanceLoans loans={data.loans} moves={data.moves} companies={data.companies} rates={rates} edit={edit} />}
      {tab === "debts" && <FinanceDebts debts={data.debts} companies={data.companies} rates={rates} edit={edit} />}
    </>
  );
}
