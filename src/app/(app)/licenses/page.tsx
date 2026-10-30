import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import { Button, Column } from "@once-ui-system/core";
import LicenseRegister from "@/components/LicenseRegister";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";

export const generateMetadata = pageTitle("Реестр лицензий");

export default async function LicensesPage() {
  const [licenses, companies] = await Promise.all([getLicenses(), getCompanies()]);
  return (
    <Column>
      <PageHeader
        title={tr("Реестр лицензий")}
        subtitle={tr("Все лицензии группы в одной таблице. Выгрузка в Excel учитывает поиск, фильтры и сортировку.")}
        actions={
          <>
            <Button href="/licenses/import" variant="secondary" prefixIcon="upload">{tr("Загрузить из Excel")}</Button>
            <ButtonLink href="/licenses/new" primary>{tr("Добавить лицензию")}</ButtonLink>
          </>
        }
      />
      <LicenseRegister licenses={licenses} companies={companies} />
    </Column>
  );
}
