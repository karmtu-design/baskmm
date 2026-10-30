import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import { Column } from "@once-ui-system/core";
import LicenseImporter from "@/components/LicenseImporter";
import { PageHeader } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";

export const generateMetadata = pageTitle("Загрузка из Excel");

export default async function ImportPage() {
  const [licenses, companies] = await Promise.all([getLicenses(), getCompanies()]);
  return (
    <Column>
      <PageHeader
        back={{ href: "/licenses", label: tr("Реестр лицензий") }}
        title={tr("Загрузка лицензий из Excel")}
        subtitle={tr("Сначала система покажет, что именно будет добавлено или изменено. В базу ничего не попадёт, пока вы не нажмёте «Загрузить».")}
      />
      <LicenseImporter
        existingNumbers={licenses.map((l) => l.license_number.trim())}
        companyNames={companies.map((c) => c.name)}
      />
    </Column>
  );
}
