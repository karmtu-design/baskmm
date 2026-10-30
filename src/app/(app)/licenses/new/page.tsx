import { tr } from "@/i18n";
import LicenseForm from "@/components/LicenseForm";
import { PageHeader } from "@/components/ui";
import { getCompanies } from "@/lib/data";
import { createLicense } from "../../actions";

export default async function NewLicensePage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { company } = await searchParams;
  const companies = await getCompanies();
  return (
    <>
      <PageHeader
        back={{ href: "/", label: tr("Обзор") }}
        title={tr("Новая лицензия")}
        subtitle={tr("После сохранения откроется карточка лицензии, где можно добавить контур участка.")}
      />
      <LicenseForm
        action={createLicense}
        companies={companies}
        defaultCompanyId={company ? Number(company) : undefined}
        submitLabel={tr("Сохранить лицензию")}
      />
    </>
  );
}
