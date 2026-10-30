import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import { Column } from "@once-ui-system/core";
import PortfolioGeo from "@/components/PortfolioGeo";
import { PageHeader } from "@/components/ui";
import { getLicenses } from "@/lib/data";

export const generateMetadata = pageTitle("Геоанализ портфеля");

export default async function AnalysisPage() {
  const licenses = await getLicenses();
  return (
    <Column>
      <PageHeader
        title={tr("Геоанализ портфеля")}
        subtitle={tr("Пересечения участков между собой и расстояния до соседних объектов группы.")}
      />
      <PortfolioGeo licenses={licenses} />
    </Column>
  );
}
