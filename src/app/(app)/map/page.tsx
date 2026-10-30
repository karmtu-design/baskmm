import { tr } from "@/i18n";
import MapExplorer from "@/components/MapExplorer";
import { PageHeader } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";

export default async function MapPage() {
  const [companies, licenses] = await Promise.all([getCompanies(), getLicenses()]);
  return (
    <>
      <PageHeader
        title={tr("Карта участков")}
        subtitle={tr("Нажмите на контур, чтобы открыть лицензию. Подложку можно переключить в правом верхнем углу карты.")}
      />
      <MapExplorer licenses={licenses} companies={companies} />
    </>
  );
}
