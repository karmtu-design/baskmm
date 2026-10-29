import MapExplorer from "@/components/MapExplorer";
import { PageHeader } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";

export default async function MapPage() {
  const [companies, licenses] = await Promise.all([getCompanies(), getLicenses()]);
  return (
    <>
      <PageHeader
        title="Карта участков"
        subtitle="Нажмите на контур, чтобы открыть лицензию. Подложку можно переключить в правом верхнем углу карты."
      />
      <MapExplorer licenses={licenses} companies={companies} />
    </>
  );
}
