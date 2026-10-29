import { Button, Column } from "@once-ui-system/core";
import LicenseRegister from "@/components/LicenseRegister";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";

export const metadata = { title: "Реестр лицензий" };

export default async function LicensesPage() {
  const [licenses, companies] = await Promise.all([getLicenses(), getCompanies()]);
  return (
    <Column>
      <PageHeader
        title="Реестр лицензий"
        subtitle="Все лицензии группы в одной таблице. Выгрузка в Excel учитывает поиск, фильтры и сортировку."
        actions={
          <>
            <Button href="/licenses/import" variant="secondary" prefixIcon="upload">
              Загрузить из Excel
            </Button>
            <ButtonLink href="/licenses/new" primary>
              Добавить лицензию
            </ButtonLink>
          </>
        }
      />
      <LicenseRegister licenses={licenses} companies={companies} />
    </Column>
  );
}
